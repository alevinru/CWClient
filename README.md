# CWClient

ChatWars REST API server

This api doesn't authorize client requests so isn't intended to by publicly accessible.

Api server may be hosted privately and respond internally, serving as a backend to another authorized api.

## Install

```Shell
git clone git@github.com:alevinru/CWClient.git

cd CWClient
```

## Setup

Since you've got managed to request and obtain valid CW API credentials you must have **username** and **password**.
It is required to set them into the environment variables named respectively as **APP_NAME** and **ACCESS_TOKEN**.

```Shell
export APP_NAME=username
export ACCESS_TOKEN=password
```

## Run

```Shell
npm run start
```

## REST API

POST /auth/:userId

POST /token/:userId/:authCode

GET /profile/:userId

GET /stock/:userId

GET /info

POST /buy/:itemCode?userId=&quantity=&price=
