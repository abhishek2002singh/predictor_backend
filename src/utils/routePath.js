const API_ROUTES_APP = {
  // Auth Routes
  AUTH_APP: "/api/auth",

  // Admin Routes
  ADMIN: "/api/admin",

  // Assistant Routes
  ASSISTANT: "/api/assistant",

  // User Data Routes
  USER_DATA: '/api',

  UPLOAD_CUTOFF : "/cutoff",

  ANALYTICS : '/api'
};

const API_ROUTES_FOR_ROUTER = {
  // Auth Routes
  AUTH_ROUTER: {
    ADMIN_LOGIN: "/admin/login",
    ADMIN_SIGNUP: "/admin/signup",
    GET_PROFILE: "/me",
    UPDATE_PROFILE: "/profile",
  },
  USER_ROUTER:{
    CREATE_USER:"/create",
    GET_ALL_USER_DATA:"/getAllUser",
    USER_DETAILS:"userDetails/:id",
    UPDATE_USER:"updateUser/:id",
    UPDATE_USER_OWN: "/update/:id",
    UPDATE_USER_BY_ADMIN_ASSISTANCE :"/update/byAdminOrAssistance/:id",
    EXPORT_USER_DATA :"/export-user-data"

  },
  ADMIN_ROUTER_PATH:{
    ALL_ADMIN:"/AllAdmin"
  },

  ASSISTANCE_ROUTER_PATH : {
    PERMISSION_OF_ASSISTANCE:"/my-permissions",
    CREATE_ASSISTANCE : "/create",
    GET_ALL_ASSISTANCE: '/allAssistance',
    GET_ASSISTANCE_DETAILS : "/:id",
    UPDATE_PERMISSION: "/:id/permissions",
    UPDATE_ASSISTANCE_STATUS:"/:id/status",
    DELETE_ASSISTANCE : "/:id"
    
  }, 
   ANALYTICS_ROUTER_PATH: {
    GET_ALL_ANALYSIS_USER: "/analytics/user-analytics",
    UPLOAD_DATA_ANALYSIS: "/analytics/upload-data-analytics",
    ASSISTANCE_ANALYSIS: "/analytics/assistance-analytics",
    ADMIN_ANALYSIS: "/analytics/admin-analytics"
  }
};

module.exports = {
  API_ROUTES_APP,
  API_ROUTES_FOR_ROUTER,
};
