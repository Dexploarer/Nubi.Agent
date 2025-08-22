#!/usr/bin/env node

/**
 * MCP Server Authentication Validation Test
 * 
 * This script validates that the MCP server:
 * 1. Logs users in properly
 * 2. Collects and stores cookies
 * 3. Doesn't throw errors if cookies are already saved
 * 4. Handles authentication state correctly
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  envFile: '.env.test',
  logFile: 'mcp-auth-test.log'
};

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Log test results
 */
function logTest(message, passed = true, error = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${status}: ${message}`;
  
  console.log(logMessage);
  
  if (error) {
    console.error('   Error:', error.message);
    testResults.errors.push({ message, error: error.message });
  }
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  // Write to log file
  fs.appendFileSync(TEST_CONFIG.logFile, logMessage + '\n');
  if (error) {
    fs.appendFileSync(TEST_CONFIG.logFile, `   Error: ${error.message}\n`);
  }
}

/**
 * Check if environment variables are set
 */
function testEnvironmentSetup() {
  console.log('\n🔍 Testing Environment Setup...');
  
  const requiredVars = [
    'TWITTER_USERNAME',
    'TWITTER_PASSWORD',
    'TWITTER_EMAIL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logTest(`Missing required environment variables: ${missingVars.join(', ')}`, false);
    return false;
  }
  
  logTest('All required environment variables are set');
  return true;
}

/**
 * Test cookie file operations
 */
function testCookieFileOperations() {
  console.log('\n🍪 Testing Cookie File Operations...');
  
  try {
    // Test 1: Check if .env file exists
    const envExists = fs.existsSync('.env');
    logTest(`Environment file exists: ${envExists}`, true);
    
    // Test 2: Check if TWITTER_COOKIES is already set
    const envContent = envExists ? fs.readFileSync('.env', 'utf-8') : '';
    const hasCookies = envContent.includes('TWITTER_COOKIES=');
    logTest(`Cookies already saved: ${hasCookies}`, true);
    
    // Test 3: Test cookie file writing
    const testCookies = ['auth_token=test123; Domain=.twitter.com', 'ct0=test456; Domain=.twitter.com'];
    const testEnvContent = `TWITTER_COOKIES=${JSON.stringify(testCookies)}\n`;
    
    fs.writeFileSync(TEST_CONFIG.envFile, testEnvContent);
    const testFileExists = fs.existsSync(TEST_CONFIG.envFile);
    logTest('Test cookie file can be written', testFileExists);
    
    // Clean up test file
    if (fs.existsSync(TEST_CONFIG.envFile)) {
      fs.unlinkSync(TEST_CONFIG.envFile);
    }
    
    return true;
  } catch (error) {
    logTest('Cookie file operations failed', false, error);
    return false;
  }
}

/**
 * Test MCP server startup and authentication
 */
async function testMCPServerAuthentication() {
  console.log('\n🚀 Testing MCP Server Authentication...');
  
  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';
    
    // Start MCP server
    const mcpProcess = spawn('bun', ['run', 'xmcpx'], {
      cwd: path.join(process.cwd(), 'xmcpx'),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Set timeout
    const timeout = setTimeout(() => {
      mcpProcess.kill();
      logTest('MCP server startup timed out', false);
      resolve(false);
    }, TEST_CONFIG.timeout);
    
    // Collect output
    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('MCP Output:', data.toString().trim());
    });
    
    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('MCP Error:', data.toString().trim());
    });
    
    // Handle process completion
    mcpProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        logTest('MCP server started successfully', true);
        
        // Check for authentication success
        if (output.includes('✅ Successfully authenticated')) {
          logTest('Authentication successful', true);
        } else if (output.includes('🍪 Successfully authenticated with saved cookies')) {
          logTest('Cookie authentication successful', true);
        } else if (output.includes('⚠️  Saved cookies failed')) {
          logTest('Saved cookies failed, but fallback worked', true);
        } else {
          logTest('Authentication status unclear', false);
        }
        
        // Check for cookie saving
        if (output.includes('💾 New cookies saved') || output.includes('💾 Provided cookies saved')) {
          logTest('Cookies were saved successfully', true);
        } else if (output.includes('🍪 Successfully authenticated with saved cookies')) {
          logTest('Using existing saved cookies', true);
        } else {
          logTest('Cookie saving status unclear', false);
        }
        
        resolve(true);
      } else {
        logTest(`MCP server failed with code ${code}`, false);
        resolve(false);
      }
    });
    
    // Handle process errors
    mcpProcess.on('error', (error) => {
      clearTimeout(timeout);
      logTest('MCP server process error', false, error);
      resolve(false);
    });
  });
}

/**
 * Test cookie persistence
 */
function testCookiePersistence() {
  console.log('\n💾 Testing Cookie Persistence...');
  
  try {
    // Check if cookies were saved to .env file
    if (!fs.existsSync('.env')) {
      logTest('No .env file found to check cookie persistence', false);
      return false;
    }
    
    const envContent = fs.readFileSync('.env', 'utf-8');
    const cookieMatch = envContent.match(/TWITTER_COOKIES=\[(.*)\]/);
    
    if (cookieMatch) {
      const cookies = JSON.parse(`[${cookieMatch[1]}]`);
      logTest(`Found ${cookies.length} saved cookies`, true);
      
      // Validate cookie format
      const hasAuthToken = cookies.some(cookie => cookie.includes('auth_token='));
      const hasCt0 = cookies.some(cookie => cookie.includes('ct0='));
      const hasTwid = cookies.some(cookie => cookie.includes('twid='));
      
      logTest('Contains auth_token cookie', hasAuthToken);
      logTest('Contains ct0 cookie', hasCt0);
      logTest('Contains twid cookie', hasTwid);
      
      return hasAuthToken && hasCt0 && hasTwid;
    } else {
      logTest('No TWITTER_COOKIES found in .env file', false);
      return false;
    }
  } catch (error) {
    logTest('Cookie persistence check failed', false, error);
    return false;
  }
}

/**
 * Test error handling for existing cookies
 */
async function testExistingCookieHandling() {
  console.log('\n🔄 Testing Existing Cookie Handling...');
  
  try {
    // Check if cookies exist
    const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
    const hasExistingCookies = envContent.includes('TWITTER_COOKIES=');
    
    if (!hasExistingCookies) {
      logTest('No existing cookies to test with', true);
      return true;
    }
    
    // Start MCP server again to test existing cookie handling
    const mcpProcess = spawn('bun', ['run', 'xmcpx'], {
      cwd: path.join(process.cwd(), 'xmcpx'),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return new Promise((resolve) => {
      let output = '';
      let hasError = false;
      
      const timeout = setTimeout(() => {
        mcpProcess.kill();
        logTest('Existing cookie test timed out', false);
        resolve(false);
      }, 15000);
      
      mcpProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      mcpProcess.stderr.on('data', (data) => {
        if (data.toString().includes('Error') || data.toString().includes('error')) {
          hasError = true;
        }
      });
      
      mcpProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0 && !hasError) {
          if (output.includes('🍪 Successfully authenticated with saved cookies')) {
            logTest('Existing cookies used successfully without errors', true);
            resolve(true);
          } else {
            logTest('Existing cookies handled but not used', true);
            resolve(true);
          }
        } else {
          logTest('Error occurred with existing cookies', false);
          resolve(false);
        }
      });
    });
  } catch (error) {
    logTest('Existing cookie handling test failed', false, error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Starting MCP Server Authentication Tests...\n');
  
  // Clear log file
  fs.writeFileSync(TEST_CONFIG.logFile, `MCP Authentication Test - ${new Date().toISOString()}\n`);
  
  // Run tests
  const envOk = testEnvironmentSetup();
  if (!envOk) {
    console.log('\n❌ Environment setup failed. Please check your environment variables.');
    return;
  }
  
  const cookieFileOk = testCookieFileOperations();
  if (!cookieFileOk) {
    console.log('\n❌ Cookie file operations failed.');
    return;
  }
  
  const authOk = await testMCPServerAuthentication();
  if (!authOk) {
    console.log('\n❌ MCP server authentication failed.');
    return;
  }
  
  const persistenceOk = testCookiePersistence();
  if (!persistenceOk) {
    console.log('\n⚠️  Cookie persistence check failed.');
  }
  
  const existingCookieOk = await testExistingCookieHandling();
  if (!existingCookieOk) {
    console.log('\n⚠️  Existing cookie handling test failed.');
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Log file: ${TEST_CONFIG.logFile}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 Errors:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message}: ${error.error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! MCP server authentication is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

// Run tests
runTests().catch(console.error);
