const express = require('express')
const analyticsRouter = express.Router()
const analyticsContoller = require('../controllers/analytics/analytics')
const { protect, adminOnly } = require("../middleware/auth.middleware");
const { API_ROUTES_FOR_ROUTER, } = require("../utils/routePath");


// protect route 
analyticsRouter.use(protect)
analyticsRouter.use(adminOnly)

analyticsRouter.get(API_ROUTES_FOR_ROUTER?.ANALYTICS_ROUTER_PATH?.GET_ALL_ANALYSIS_USER , analyticsContoller?.analyticsUserData)
analyticsRouter.get(API_ROUTES_FOR_ROUTER?.ANALYTICS_ROUTER_PATH?.UPLOAD_DATA_ANALYSIS , analyticsContoller?.uploadDataAnalytics)
analyticsRouter.get(API_ROUTES_FOR_ROUTER?.ANALYTICS_ROUTER_PATH?.ASSISTANCE_ANALYSIS , analyticsContoller?.assistanceAnalysis)
analyticsRouter.get(API_ROUTES_FOR_ROUTER?.ANALYTICS_ROUTER_PATH?.ADMIN_ANALYSIS , analyticsContoller?.allAdminAnalysis)


module.exports =  analyticsRouter



