const express = require('express')
const rankRouter= express.Router()
const { API_ROUTES_FOR_ROUTER } = require("../utils/routePath");

const rankPredictionOfCollege= require('../controllers/rankpredictionOfCollege/rankPredictionOfCollege')

console.log("haa jii batao")

rankRouter.post(API_ROUTES_FOR_ROUTER?.RANK_PREDICTION_OF_COLLEGE?.GET_RANK_PREDICTION , rankPredictionOfCollege?.rankPredictionOfCollege)

module.exports = rankRouter