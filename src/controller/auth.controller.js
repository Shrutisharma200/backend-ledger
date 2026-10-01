const userModel = require("../models/user.model")
const jwt = require("jsonwebtoken")
const emailServices= require("../services/email.service")
const accountModel = require("../models/account.model")
const tokenBlackListModel = require("../models/blackList.model")

/**
 * - user register controller
 * - Post/api/auth/register
 *
 */

 async function userRegisterController(req, res){
    const { email, password, name} =  req.body


    const isExist = await userModel.findOne({
        email:email
    })

    if (isExist){
        return res.status(422).json({
            message:"User already exists with email.",
            status:"failed"
        })
    }
     const user = await userModel.create({
        email, password, name
    })
     
    const token = jwt.sign({userId:user._id}, process.env.JWT_SECRET,{
        expiresIn: "3d"
    })

    res.cookie("token", token)

    res.status(201).json({
        user:{
            _id:user._id,
            email:user.email,
            name:user.name
        },
        token
    })
    await emailServices.sendRegistrationEmail(user.email, user.name)
} 

/**
 * - user login controller
 * - Post/api/auth/login
 *
 */

async function userLoginController(req, res){
    const { email, password } = req.body

    const user = await userModel.findOne({email}).select("+password")

    if(!user){
        return res.status(401).json({
            message:"Email or password is Invalid"
        })
    }

   const isValidPassword = await user.comparePassword(password)

     if(!isValidPassword){
        return res.status(401).json({
            message:"Email or password is Invalid"
        })
    }
       const token = jwt.sign({userId:user._id}, process.env.JWT_SECRET,{
        expiresIn: "3d"
    })

    res.cookie("token", token)

    res.status(200).json({
        user:{
            _id:user._id,
            email:user.email,
            name:user.name
        },
        token
    })
}

/**
 * - user logout controller
 * - Post/api/auth/logout
 *
 */
async function userLogoutController(req, res){
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if(!token){
        return res.status(200).json({
            message:"User logged out successfully"
        })
    }

    
    await tokenBlackListModel.create({
        token:token

    })
     res.clearCookie("token")
     

     return res.status(200).json({
        message:"User logged out successfully"

    })
}


module.exports = { 
    userRegisterController,
    userLoginController,
    userLogoutController 
}