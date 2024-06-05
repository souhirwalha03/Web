const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const EventHubReader = require("../scripts/event-hub-reader.js");
const { Client } = require("azure-iothub");
const { EventHubConsumerClient } = require("@azure/event-hubs");
const EventEmitter = require("events");
const dataEmitter = new EventEmitter();

("use strict");

var Message = require("azure-iot-common").Message;
const connectionString =
  "HostName=evcsHub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=XMUuMZgN+pd2xs/sPVN4vEcJztHf28mEPAIoTA5L2ZQ=";
var targetDevice = "evcsDevice";

var serviceClient = Client.fromConnectionString(connectionString);
const eventHubName = "iothub-ehub-evcshub-59299761-e00c403fa3";
const consumerGroup = "$Default";
const connectionString1 =
  "Endpoint=sb://ihsuprodblres058dednamespace.servicebus.windows.net/;SharedAccessKeyName=iothubowner;SharedAccessKey=Kk5EnysmSNHAA4gsYY7zLKx7aPu5l7qJ2AIoTMaTu5M=;EntityPath=iothub-ehub-evcshub-59299761-e00c403fa3";

const consumerClient = new EventHubConsumerClient(
  consumerGroup,
  connectionString1,
  eventHubName
);

let balance = 0;
let Balance;

let maxChargingTime = 0;
let sessionID1;
let stop_clicked = 0;
let chargingPower;
if (!connectionString) {
  console.error(
    `Environment variable IotHubConnectionString must be specified.`
  );
  process.exit(1);
}

const eventHubConsumerGroup = "gr";
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);

const wss = new WebSocket.Server({ port: 3001 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
let chargingstarted = null;
let energy = null;
let cost = null;

// Function to wait for the 'dataReady' event
function waitForData() {
  return new Promise((resolve) => {
    dataEmitter.once("dataReady", resolve);
  });
}

function checkStatus(data) {
  try {
    const parsedData = JSON.parse(data);

    if (parsedData.IotData && parsedData.IotData.status === 1) {
      chargingstarted = parsedData.IotData.status;
      console.log(`charging: ${chargingstarted}`);
    }
    // Check if the message contains energy and cost information
    if (
      parsedData.IotData.status === 0 &&
      "energy" in parsedData.IotData &&
      "Balance" in parsedData.IotData
    ) {
      chargingstarted = parsedData.IotData.status;
      console.log(`charging: ${chargingstarted}`);
      energy = parsedData.IotData.energy;
      Balance = parsedData.IotData.Balance;
      console.log(`Energy: ${energy}, balance: ${Balance}`);
      // Emit an event when energy and Balance are defined
      dataEmitter.emit("dataReady");
    }
  } catch (error) {
    console.log("Error parsing data:", error);
  }
}

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log(`Broadcasting data ${data}`);
        checkStatus(data);
        client.send(data);
      } catch (e) {
        console.error(e);
      }
    }
  });
};

let station_id;
const eventHubReader = new EventHubReader(
  connectionString,
  eventHubConsumerGroup
);

(async () => {
  await eventHubReader.startReadMessage((message, date, deviceId) => {
    try {
      const currentDate = date ? new Date(date) : new Date();
      const formattedDate = currentDate.toLocaleDateString();
      const formattedTime = currentDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const payload = {
        IotData: message,
        //MessageDate: date || new Date().toISOString(),
        MessageDate: `${formattedDate} ${formattedTime}`,

        DeviceId: deviceId,
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error("Error broadcasting:", err);
    }
  });
})();

function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(op + " error: " + err.toString());
    if (res) console.log(op + " status: " + res.constructor.name);
  };
}

// let resolveStatus1;
// let resolveStatus0;

// async function receive() {
//   try {
//     // Subscribe to events from all partitions
//     const subscription = consumerClient.subscribe({
//       processEvents: async (events, context) => {
//         for (const event of events) {
//           const message = event.body;
//           console.log(`Received message: ${JSON.stringify(message)}`);

//           if (message.status === 1 && resolveStatus1) {
//             resolveStatus1();
//           } else if (message.status === 0 && message.energy && message.cost && resolveStatus0) {
//             resolveStatus0();
//           }
//         }
//       },
//       processError: async (err) => {
//         console.log(`Error: ${err.message}`);
//       }
//     });

//     // Keep the subscription running indefinitely
//     await new Promise(() => {});
//   } catch (err) {
//     console.log("Error: ", err.message);
//   }
// }

function waitForStatus(status) {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (chargingstarted === status) {
        clearInterval(checkInterval);
        resolve();
      } else if (stop_clicked == 1) {
        clearInterval(checkInterval);
        chargingstarted = 0;
        resolve();
      }
    }, 1000); // Check every second
  });
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
function calculateMaxChargingTime(initialBalance, chargingRate, chargingPower) {
  // Calculate maximum energy available
  let maxenergy = initialBalance / chargingRate;
  console.log("maxenergy", maxenergy);

  // Calculate maximum charging time in hours
  let maxChargingTime = maxenergy / chargingPower;
  console.log("calculateMaxChargingTime", maxChargingTime);
  

  // Convert total hours to hours and minutes
  const hours = Math.floor(maxChargingTime);
  console.log("hours", hours);
  
  const minutes = Math.round((maxChargingTime - hours) * 60);
  console.log("minutes", minutes);


  return {   hours, minutes };
}
function send_to_IoThub(value, balance, chargingRate) {
  let messages = [];
  messages.push({ start: value, balance: balance, chargingRate: chargingRate });

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
        INSERT INTO Charging_sessions (start_time, Status, client_id)
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
        SET end_time = '${datetime}', cost = ${cost}, Status = 0
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
      .query`SELECT Pricing, power_rating FROM Charging_stations WHERE station_id = ${req.body.qrcodeInt} `;
    const chargingRate = result1.recordset[0].Pricing;
    chargingPower = result1.recordset[0].power_rating;
    maxChargingTime = calculateMaxChargingTime(balance, chargingRate, chargingPower);

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
    
    const pool = await poolPromise;

    //* Retrieve Pricing and Client Balance */
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

    //* send statrt 1
    send_to_IoThub(1, balance, chargingRate);

    //* wait for confirmation
    // await receive(); // Start receiving messages
    // console.log("Waiting for status 1...");
    await waitForStatus(1); // Wait for status 1 message
    console.log("Received status 1 message!");

    //* insert sessionid && client_id && station_id*/
    //* Insert Charging Session
    await pool.request().query(`
        INSERT INTO Charging_sessions (client_id, station_id)
        VALUES('${req.session.userId}', '${req.body.qrcodeInt}')
        `);
    station_id = req.body.qrcodeInt;
    //* Retrieve Latest Session ID
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

    //* insert start time && Update status 1 */

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
        SET start_time = '${datetime}', Status=1
        WHERE session_id = ${sessionID1}`);

    let result11 = await pool.request().query(`
        UPDATE Charging_stations 
        SET availability = 'Unavailable'
        WHERE station_id = ${req.body.qrcodeInt} `);

    await waitForStatus(0); // Wait for status 1 message
    console.log("Received status 0 message!");

    if (stop_clicked == 0) {
      // send_to_IoThub(0, balance);
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

      cost = (balance - Balance).toFixed(2);
      // if (balance < 0) {
      //   balance = 0;
      // }
      let result8 = await pool.request().query(`
                UPDATE Charging_sessions 
                SET end_time = '${datetime}', Status = 0, Cost=${cost}, energy_consumed=${energy}
                WHERE  session_id = '${sessionID1}' 
            `);
      let result12 = await pool.request().query(`
                UPDATE Charging_stations 
                SET availability = 'Available'
                WHERE station_id = ${req.body.qrcodeInt} `);

      result6 = await pool.request().query(`
                UPDATE Clients
                SET account_balance = ${Balance}
                WHERE client_id = ${req.session.userId}
            `);

      if (stop_clicked == 0) {
        res.json({ account_balance: Balance, sessionID: sessionID1 });
      }
      stop_clicked = 0;

      // console.log("Waiting for status 0...");
      // await waitForStatus(); // Wait for status 0 message
      // console.log("Received status 0 message!");

      //* Calculate Max Charging Time*/

      // maxChargingTime = calculateMaxChargingTime(balance, chargingRate);
      // console.log(
      //   "maxChargingTime.totalMilliseconds:",
      //   maxChargingTime.totalMilliseconds
      // );

      // //* Charging Session Loop
      // let timeDifferenceMS = 0;
      // let currentTime = 0;

      // while (
      //   balance > 0 &&
      //   timeDifferenceMS < maxChargingTime.totalMilliseconds &&
      //   stop_clicked != 1
      // ) {
      //   await new Promise((resolve) => setTimeout(resolve, 1000));

      //   console.log("startTime", startTime);
      //   currentTime = Date.now();

      //   timeDifferenceMS = Math.round(currentTime - startTime);

      //   console.log("Current Time:", currentTime);
      //   console.log("Start Time:", startTime);
      //   console.log("timeDifferenceMS:", timeDifferenceMS);
      //   console.log("maxChargingTime:", maxChargingTime.totalMilliseconds);
      // } //* WHILE LOOP
    } else if (stop_clicked == 1) {
      res.json({ stop: 1 });
    }
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stop_session", async (req, res) => {
  const { sessionId } = req.body;

  try {
    stop_clicked = 1;
    console.log("stop");
    send_to_IoThub(0, 0, 0);

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

    await waitForData();

    const result = await pool.request()
      .query`SELECT account_balance FROM clients WHERE client_id = ${req.session.userId}`;
    console.log(`Energy: ${energy}, balance: ${Balance}`);
    balance = result.recordset[0].account_balance;
    cost = (balance - Balance).toFixed(2);
    console.log(`Energy: ${energy}, balance: ${Balance}`);
    let result12 = await pool.request().query(`
                UPDATE Charging_stations 
                SET availability = 'Available'
                WHERE station_id = ${station_id} `);

    result6 = await pool.request().query(`
                UPDATE Clients
                SET account_balance = ${Balance}
                WHERE client_id = ${req.session.userId}
            `);
    let result1 = await pool.request().query(`
            UPDATE Charging_sessions 
            SET end_time = '${datetime}', Status = 0, Cost=${cost}, energy_consumed=${energy}
            WHERE  client_id = ${req.session.userId} AND Status = 1
        `);
    stop_clicked = 0;
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
