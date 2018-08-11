# CWClient

ChatWars REST API server

## Install

```Shell
git clone git@github.com:alevinru/CWClient.git

cd CWClient
```

## Setup

Since you've got managed to request and obtain valid CW API credentials you must have **username** and **password**.
It is required to set them into the environment variables named responsively as **APP_NAME** and **ACCESS_TOKEN**.

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
