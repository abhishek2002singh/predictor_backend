const express = require("express");
const userDataRouter = express.Router();
const {
  createUserData,
  getUserData,
  getAllUserData,
  updateUserData,
  deleteUserData,
} = require("../controllers/UserController/userDataController");
const { API_ROUTES_FOR_ROUTER, } = require("../utils/routePath");



userDataRouter.post(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.CREATE_USER, createUserData);


userDataRouter.get(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.GET_ALL_USER_DATA, getAllUserData);


userDataRouter.get(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.USER_DETAILS, getUserData);


userDataRouter.put(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.UPDATE_USER, updateUserData);


// userDataRouter.delete("/:id", deleteUserData);

module.exports = userDataRouter;
