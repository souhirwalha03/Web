const express = require("express");
const bodyParser = require("body-parser");

require("./config/connect");

const registersignup = require("./routes/register");
const routelogin = require("./routes/login");
const routeclients = require("./routes/clients");
const routechargers = require("./routes/chargers");
const routesessions = require("./routes/sessions");
const routecars = require("./routes/car");
const routecharging_session = require("./routes/charging_session");
const routemap = require("./routes/map");
const routechart = require("./routes/chart");
const routeprofile = require("./routes/profilee");
const routecompanies = require("./routes/companies");

const app = express();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(registersignup);
app.use(routelogin);
app.use(routeclients);
app.use(routechargers);
app.use(routesessions);
app.use(routecars);
app.use(routecharging_session);
app.use(routemap);
app.use(routechart);
app.use(routeprofile);
app.use(routecompanies);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
