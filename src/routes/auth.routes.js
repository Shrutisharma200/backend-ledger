const express = require("express")
const router = express.Router()
const authController = require("../controller/auth.controller")

// Post /api/auth/register
router.post("/register", authController.userRegisterController)

// Post /api/auth/login
router.post("/login", authController.userLoginController)

//Post /api/auth/logout
router.post("/logout", authController.userLogoutController)


module.exports = router