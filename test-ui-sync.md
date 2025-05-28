# UI Settings Synchronization Test Plan

## Overview
This document outlines how to test the new UI settings synchronization feature that ensures all users share the same UI settings as the `PUBLIC_CHARACTER_USER_ID`.

## Prerequisites
1. A running Agnaistic instance
2. MongoDB database with at least two user accounts
3. The `PUBLIC_CHARACTER_USER_ID` environment variable configured

## Test Setup

### Step 1: Configure Environment
1. Set the `PUBLIC_CHARACTER_USER_ID` environment variable to a valid user ID:
   ```bash
   PUBLIC_CHARACTER_USER_ID=your-public-user-id-here
   ```
2. Restart the application

### Step 2: Identify Test Users
- **Public User**: The user whose ID is set in `PUBLIC_CHARACTER_USER_ID`
- **Regular User**: Any other user account

## Test Cases

### Test Case 1: UI Settings Loading
**Objective**: Verify that regular users load UI settings from the public user

**Steps**:
1. Log in as the public user
2. Go to Settings > UI Settings
3. Change some UI settings (e.g., theme color, avatar size, chat width)
4. Log out
5. Log in as a regular user
6. Check the UI settings

**Expected Result**: The regular user should have the same UI settings as the public user

### Test Case 2: UI Settings Synchronization
**Objective**: Verify that UI changes are synchronized across all users

**Steps**:
1. Open two browser windows/tabs
2. Log in as the public user in one window
3. Log in as a regular user in the other window
4. In the regular user window, go to Settings > UI Settings
5. Change a UI setting (e.g., switch from dark to light mode)
6. Observe both windows

**Expected Result**: Both windows should immediately reflect the UI change

### Test Case 3: Fallback Behavior
**Objective**: Verify graceful fallback when public user doesn't exist

**Steps**:
1. Set `PUBLIC_CHARACTER_USER_ID` to a non-existent user ID
2. Restart the application
3. Log in as any user
4. Check the console for warning messages
5. Verify UI settings still work

**Expected Result**: 
- Warning message in server console about non-existent public user
- User can still use their own UI settings
- No application errors

### Test Case 4: Public User Exclusion
**Objective**: Verify that the public user's own settings aren't overridden

**Steps**:
1. Log in as the public user
2. Change UI settings
3. Verify the changes are applied immediately
4. Log out and log back in as the public user
5. Verify settings are preserved

**Expected Result**: The public user should be able to modify and retain their own UI settings

## Verification Points

### Server-Side Verification
1. Check server logs for any error messages related to UI settings
2. Verify that UI updates are sent to all connected users (check WebSocket messages)
3. Confirm that UI settings are stored in the public user's database record

### Client-Side Verification
1. Verify that UI changes are applied immediately across all connected users
2. Check that the correct UI settings are loaded on page refresh
3. Ensure no JavaScript errors in browser console

### Database Verification
1. Check that UI settings are stored in the public user's document in MongoDB
2. Verify that regular users' UI settings are not being updated in the database
3. Confirm that only the public user's UI settings are being modified

## Troubleshooting

### Common Issues
1. **UI settings not synchronizing**: Check WebSocket connection and server logs
2. **Settings not persisting**: Verify database connection and public user exists
3. **JavaScript errors**: Check browser console for client-side errors

### Debug Steps
1. Enable debug logging: `LOG_LEVEL=debug npm run start`
2. Check WebSocket messages in browser developer tools
3. Verify `PUBLIC_CHARACTER_USER_ID` is correctly set and user exists
4. Check MongoDB for UI settings in the public user's document

## Success Criteria
- ✅ Regular users load UI settings from the public user
- ✅ UI changes are synchronized in real-time across all users
- ✅ Graceful fallback when public user doesn't exist
- ✅ Public user can modify their own settings
- ✅ No application errors or crashes
- ✅ Settings persist across browser sessions 