const API_ROUTES_APP = {
  // Auth Routes
  AUTH_APP: "/api/auth",

  // Admin Routes
  ADMIN: "/api/admin",

  // Assistant Routes
  ASSISTANT: "/api/assistant",

  // User Data Routes
  USER_DATA: '/api'
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
    UPDATE_USER:"updateUser/:id"

  }
};

module.exports = {
  API_ROUTES_APP,
  API_ROUTES_FOR_ROUTER,
};
