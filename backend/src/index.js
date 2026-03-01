const express = require("express");
const cors = require("cors");
const authRoute = require("./routes/authRoute")
const clientsRoute = require("./routes/clientsRoute.js")
const usersRoute = require("./routes/usersRoute")
const productsRoute = require("./routes/productsRoute")
const cashRoute = require("./routes/cashRoute")
const salesRoute = require("./routes/salesRoute")
require('dotenv').config()

const app = express()

const port = process.env.PORT

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors({
  origin: process.env.ORIGIN_URL,
  credentials: true,
}));


app.use("/auth", authRoute);
app.use("/clients", clientsRoute);
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use("/users", usersRoute); 
// app.use("/customers", customersRoute); 
// app.use("/sales", salesRoute);
// app.use("/cash", cashRoute);
// app.use("/products", productsRoute);

app.use("/", (_req, res) => res.status(200).send("Online."));

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})