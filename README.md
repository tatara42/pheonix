# Phoenix : IMF Gadget API

This document details the Phoenix: IMF Gadget API, a Node.js application built with Express.js, PostgreSQL, and JSON Web Tokens (JWT) for user authentication and gadget management

## Overview

The Phoenix API provides endpoints for user authentication, registration, and CRUD operations on gadgets stored in a PostgreSQL database. It utilizes JWT for secure authentication and authorization..

### Prerequisites

- Node.js and npm installed
- PostgreSQL database
- Environment variables configured (see "Environment Variables" section)


### Environment Variables

- PG_CONNECTION_STRING: The PostgreSQL database connection string.
- PORT: The port number the server will listen on (defaults to 8080).
- REFRESH_TOKEN_SECRET: The secret key for signing refresh tokens.
- ACCESS_TOKEN_SECRET: The secret key for signing access tokens.
- REGISTER_SECRET: Secret used to register new users

### Database Schema
pheonix_user:

    username (VARCHAR, PRIMARY KEY)
    password (VARCHAR)

gadgets:

    id (SERIAL, PRIMARY KEY)
    name (VARCHAR, UNIQUE)
    status (VARCHAR)

### API Endpoints
1. Root Endpoint

    GET /
        Description: Returns a welcome message.
        Response: "Fly Fly, Pheonix, Fly!"

2. User Authentication

    POST /login:
        Authenticates a user and generates access and refresh tokens.
   
    POST /signout:
        Invalidates a refresh token.
   
    POST /token:
        Generates a new access token using a refresh token.
   
    POST /register:
        Registers a new user.

4. Gadget Management
    Authorization: Requires a valid access token.
   
    GET /gadgets/:id:
        Retrieves a gadget by ID.
    GET /gadgets:
        Retrieves a list of gadgets, optionally filtered by status.
   
    POST /gadgets:
        Creates a new gadget with a randomly generated name and "Available" status.
   
    PATCH /gadgets:
        Updates a gadget's name or status.
   
    DELETE /gadgets:
        Decommissions a gadget by setting its status to "Decommissioned".
   
    POST /gadgets/:id/self-destruct:
        Generates a confirmation code for gadget self-destruction.
   
    POST /gadgets/:id/confirm-self-destruct:
        Destroys a gadget after confirmation with the generated code.
   
    POST /gadgets/:id/confirm-thanos:
        Deletes a gadget permanently from the database.
   
### Deploying

Deploy with render, neondb and uptimerobot for 100% uptime

## Contributing

You don't.
