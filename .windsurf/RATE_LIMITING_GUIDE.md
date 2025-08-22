# Rate Limiting Guide

## Where
- Routes (Sessions API), platform posting, Socket.IO events.

## How
- Token bucket or fixed window; identify by userId/roomId/channel.

## Abuse Controls
- Temporary blocks for repeated violations; surface clear error messages.
