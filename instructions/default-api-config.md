# Default Agnaistic Subscriber API Configuration

This document explains how to set up default API credentials for the Agnaistic Subscriber API service.

## Background
When users don't provide their own Agnaistic Subscriber API credentials, the system can now use default credentials specified in environment variables. This prevents the "URL and API key are required" error for users who haven't configured their own API settings.

## Setup Instructions

### Method 1: Environment Variables

Add the following environment variables to your deployment environment:

```
AGNAI_SUBSCRIBER_API_URL=https://api.agnai.chat/v1
AGNAI_SUBSCRIBER_API_KEY=your_default_api_key_here
```

Replace `your_default_api_key_here` with your actual API key.

### Method 2: .env File (Development/Local Setup)

1. Create a `.env` file in the root directory of the project if it doesn't exist
2. Add the following lines:

```
AGNAI_SUBSCRIBER_API_URL=https://api.agnai.chat/v1
AGNAI_SUBSCRIBER_API_KEY=your_default_api_key_here
```

3. Replace `your_default_api_key_here` with your actual API key
4. Restart the application for the changes to take effect

### Method 3: Docker Compose (Self-hosting)

If you're using Docker Compose for self-hosting, add these environment variables to your `docker-compose.yml` file:

```yaml
services:
  agnaistic:
    # ... existing configuration ...
    environment:
      - AGNAI_SUBSCRIBER_API_URL=https://api.agnai.chat/v1
      - AGNAI_SUBSCRIBER_API_KEY=your_default_api_key_here
```

## Security Considerations

- Keep your API key confidential and never commit it to version control
- Consider using a dedicated API key for this purpose with appropriate usage limits
- The default API key will be used by all users who haven't configured their own credentials
- Be aware that this may lead to higher API usage costs depending on your user base

## Troubleshooting

If users are still seeing the "URL and API key are required" error:

1. Verify the environment variables are correctly set
2. Restart the application after setting the variables
3. Check server logs for any related errors
4. Ensure your API key is valid and has not expired 