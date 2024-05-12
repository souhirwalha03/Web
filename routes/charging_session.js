const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");

("use strict");

var Client = require("azure-iothub").Client;
var Message = require("azure-iot-common").Message;
var connectionString =
  "HostName=evcsHub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=XMUuMZgN+pd2xs/sPVN4vEcJztHf28mEPAIoTA5L2ZQ=";
var targetDevice = "evcsDevice";
var serviceClient = Client.fromConnectionString(connectionString);

let balance = 0;
let maxChargingTime = 0;
let sessionID1;
let stop_clicked = 0;

function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(op + " error: " + err.toString());
    if (res) console.log(op + " status: " + res.constructor.name);
  };
}

function receiveFeedback(err, receiver) {
  if (err) {
    console.error("Error receiving feedback: " + err.toString());
    return;
  }

  receiver.on("message", function (msg) {
    console.log("Feedback message:");
    console.log(msg.getData().toString("utf-8"));
  });
}

serviceClient.open(function (err) {
  if (err) {
    console.error("Could not connect: " + err.message);
  } else {
    console.log("Service client connected");
    serviceClient.getFeedbackReceiver(receiveFeedback);
  }
});
function calculateMaxChargingTime(initialBalance, chargingRate) {
  let totalMinutes = (initialBalance / chargingRate) * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  totalMinutes = Math.round(totalMinutes);

  const totalMilliseconds = totalMinutes * 60000;

  return { totalMilliseconds, totalMinutes, hours, minutes };
}
function send_to_IoThub(value) {
  let messages = [];
  messages.push({ start: value });

  var message = new Message(JSON.stringify(messages));
  message.ack = "full";
  message.messageId = "My Message ID";
  console.log("Sending message: " + message.getData());
  serviceClient.send(targetDevice, message, printResultFor("send"));
}

var start = 0;
let j = 1;
async function currenttime(
  pool,
  val,
  timeDifferenceMS,
  chargingRate,
  console,
  ID,
  req
) {
  console.log("11 ");

  var currentdate = new Date();
  var datetime =
    currentdate.getDate() +
    "/" +
    (currentdate.getMonth() + 1) +
    "/" +
    currentdate.getFullYear() +
    " @ " +
    currentdate.getHours() +
    ":" +
    currentdate.getMinutes() +
    ":" +
    currentdate.getSeconds();

  if (j == 1) {
    start = datetime;
    console.log("hi ");

    j++;
  }
  console.log("12 ");

  console.log("start 1", start);
  console.log("datetime 1", datetime);

  if (val === "start") {
    // start
    console.log("start 2", start);

    result = await pool.request().query(`
        INSERT INTO Charging_sessions (start_time, status, client_id)
        VALUES('${datetime}',1, ${ID})
        

    `);
    return datetime;
  } else {
    // stop
    let cost = timeDifferenceMS * (chargingRate / 60);
    console.log("cost", cost);
    console.log("timeDifferenceMS", timeDifferenceMS);
    console.log("chargingRate", chargingRate);
    console.log("datetime", datetime);
    console.log("start", start);

    result1 = await pool.request().query(`
        UPDATE Charging_sessions 
        SET end_time = '${datetime}', cost = ${cost}, status = 0
        WHERE start_time ='${start}'`);
    return datetime;
  }
}

router.post("/charging_session", async (req, res) => {
  try {
    const pool = await poolPromise;
    let result = await pool.request()
      .query`SELECT account_balance FROM clients WHERE client_id = ${req.session.userId}`;
    balance = result.recordset[0].account_balance;

    const result1 = await pool.request()
      .query`SELECT Pricing FROM Charging_stations WHERE station_id = ${req.body.qrcodeInt} `;
    const chargingRate = result1.recordset[0].Pricing;

    maxChargingTime = calculateMaxChargingTime(balance, chargingRate);

    const ChargingTime = `${maxChargingTime.hours} hours ${maxChargingTime.minutes} minutes`;
    console.log("req.body.qrcodeInt ", req.body.qrcodeInt);

    const result10 = await pool.request().query`SELECT  TOP 1 Status 
        FROM Charging_sessions 
        WHERE station_id = ${req.body.qrcodeInt} 
        ORDER BY session_id DESC`;

    let status1 = result10.recordset[0].Status;
    console.log("status", status1);

    if (result.recordset.length > 0) {
      res.json({
        account_balance: balance,
        chargingtime: maxChargingTime,
        status: status1,
      });
    } else {
      res.status(404).json({ error: "Session ID not found" });
    }
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/station_details", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(`SELECT * FROM Charging_stations `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/START_session1", async (req, res) => {
  try {
    console.log("sessionID1", sessionID1);
    const pool = await poolPromise;
    /* insert sessionid && client_id && station_id*/

    await pool.request().query(`
        INSERT INTO Charging_sessions (client_id, station_id)
        VALUES('${req.session.userId}', '${req.body.qrcodeInt}')
        `);

    let result5 = await pool.request().query(`
        SELECT TOP 1 session_id
        FROM Charging_sessions
        ORDER BY session_id DESC
        `);

    if (result5.recordset.length > 0) {
      sessionID1 = result5.recordset[0].session_id;
      console.log("New session_id:", sessionID1);
    } else {
      console.error("Failed to fetch session_id.");
    }

    console.log("sessionID1", sessionID1);

    /* insert start time && status 1 */

    var currentdate = new Date();
    var datetime =
      currentdate.getDate() +
      "/" +
      (currentdate.getMonth() + 1) +
      "/" +
      currentdate.getFullYear() +
      " @ " +
      currentdate.getHours() +
      ":" +
      currentdate.getMinutes() +
      ":" +
      currentdate.getSeconds();
    let startTime = Date.now();
    console.log("startTime", startTime);
    console.log("datetime", datetime);

    let result0 = await pool.request().query(`
        UPDATE Charging_sessions 
        SET start_time = '${datetime}', status=1
        WHERE session_id = ${sessionID1}`);

    let result11 = await pool.request().query(`
        UPDATE Charging_stations 
        SET availability = 'Unavailable'
        WHERE station_id = ${req.body.qrcodeInt} `);

    /* get station Pricing && client balance */
    let chargingRate = null;
    const result1 = await pool.request()
      .query`SELECT Pricing FROM Charging_stations WHERE station_id = ${req.body.qrcodeInt}`;

    if (result1.recordset.length > 0) {
      chargingRate = result1.recordset[0].Pricing;
      console.log("chargingRate", chargingRate);
    } else {
      console.log("No record found for sessionId:", sessionId);
    }

    balance = 0;

    const result = await pool.request()
      .query`SELECT account_balance FROM Clients WHERE client_id = ${req.session.userId}`;
    balance = result.recordset[0].account_balance;
    console.log("balance", balance);

    /* calculate maxChargingTime */

    maxChargingTime = calculateMaxChargingTime(balance, chargingRate);
    console.log(
      "maxChargingTime.totalMilliseconds:",
      maxChargingTime.totalMilliseconds
    );

    let timeDifferenceMS = 0;
    let currentTime = 0;
    while (
      balance > 0 &&
      timeDifferenceMS < maxChargingTime.totalMilliseconds &&
      stop_clicked != 1
    ) {
      send_to_IoThub(1);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("startTime", startTime);
      currentTime = Date.now();

      timeDifferenceMS = Math.round(currentTime - startTime);

      console.log("Current Time:", currentTime);
      console.log("Start Time:", startTime);
      console.log("timeDifferenceMS:", timeDifferenceMS);
      console.log("maxChargingTime:", maxChargingTime.totalMilliseconds);
    } // WHILE LOOP

    if (stop_clicked == 1) {
      res.json({ stop: 1 });
    }

    send_to_IoThub(0);
    var currentdate = new Date();
    var datetime =
      currentdate.getDate() +
      "/" +
      (currentdate.getMonth() + 1) +
      "/" +
      currentdate.getFullYear() +
      " @ " +
      currentdate.getHours() +
      ":" +
      currentdate.getMinutes() +
      ":" +
      currentdate.getSeconds();

    let cost = (0.0833 * timeDifferenceMS * 1.667 * 0.00001).toFixed(2);
    balance = (balance - cost).toFixed(2);
    if (balance < 0) {
      balance = 0;
    }
    let result8 = await pool.request().query(`
                UPDATE Charging_sessions 
                SET end_time = '${datetime}', status = 0, Cost=${cost}
                WHERE  session_id = '${sessionID1}' 
            `);
    let result12 = await pool.request().query(`
                UPDATE Charging_stations 
                SET availability = 'Available'
                WHERE station_id = ${req.body.qrcodeInt} `);

    result6 = await pool.request().query(`
                UPDATE Clients
                SET account_balance = ${balance}
                WHERE client_id = ${req.session.userId}
            `);

    if (stop_clicked == 0) {
      res.json({ account_balance: balance, sessionID: sessionID1 });
    }
    stop_clicked = 0;
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stop_session", async (req, res) => {
  const { sessionId } = req.body;

  try {
    stop_clicked = 1;
    send_to_IoThub(0);

    const pool = await poolPromise;
    var currentdate = new Date();
    var datetime =
      currentdate.getDate() +
      "/" +
      (currentdate.getMonth() + 1) +
      "/" +
      currentdate.getFullYear() +
      " @ " +
      currentdate.getHours() +
      ":" +
      currentdate.getMinutes() +
      ":" +
      currentdate.getSeconds();
    console.log("datetime", datetime);

    let result1 = await pool.request().query(`
            UPDATE Charging_sessions 
            SET end_time = '${datetime}', status = 0
            WHERE  client_id = ${req.session.userId} AND status = 1
        `);

    const result = await pool.request()
      .query`SELECT account_balance FROM clients WHERE client_id = ${req.session.userId}`;
    balance = result.recordset[0].account_balance;
    if (result.recordset.length > 0) {
      res.json({ account_balance: balance });
    } else {
      res.status(404).json({ error: "Session ID not found" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
