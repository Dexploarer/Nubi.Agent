/**
 * Load test functions for Artillery
 */
module.exports = {
  /**
   * Generate a request with the specified parameters
   */
  generateRequest: function(userContext, events, done) {
    // Generate a unique ID for the request
    userContext.vars.id = Date.now().toString();
    
    // Set the method, tool name, and arguments from the parameters
    userContext.vars.method = userContext.vars.params.method;
    userContext.vars.toolName = userContext.vars.params.toolName;
    userContext.vars.arguments = userContext.vars.params.arguments;
    
    return done();
  }
}; 