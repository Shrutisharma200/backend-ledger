const express = require("express");
const cookieParser = require("cookie-parser")

const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")
const transactionRoutes = require("./routes/transaction.routes")
const app = express();

app.use(express.json())
app.use(cookieParser())

app.get("/", (req, res) => {
    res.send("Ledger Service is up and running")
})
app.use("/api/auth", authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)
module.exports = app;