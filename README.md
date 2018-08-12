# CWClient

ChatWars REST API server

> ⚠️ This API doesn't authorize client requests so isn't intended to be publicly accessible.
The server may be hosted only privately to serve as a backend responding internally to another authorized api.

At the moment the API has no persistence and serves for one user only.
Next release to be configurable to support Redis as persistent storage.

## Install

```Shell
git clone git@github.com:alevinru/CWClient.git

cd CWClient
```

## Setup

Since you've got managed to request and obtain valid CW API credentials you must have `username` and `password`.
It is required to set them into the environment variables named respectively as `APP_NAME` and `ACCESS_TOKEN`.

```Shell
export APP_NAME=username
export ACCESS_TOKEN=password
```

By default, http server starts on port 8888 and connects to CW3 api instance. 
This is configurable with environment variables for which default values are provided in the bundled [nodemon.json](nodemon.json) file.


## Run

```Shell
npm run start
```

Upon success you need to get a valid CW `usesId` and ask that user for an authorization doing:

```
http POST localhost:8888/api/auth/101010101
```

Then CW Telegram Bot sends an authorization request message to the user Telegram account

```
Code 11223344 to authorize aliovin_CWClientAppBot. This app will have the access to:
 - read your profile information
 - issue a wtb/wts/rm commands on your behalf
 - read your stock info
```

Now you need to use this `code` to get user `token`:

```
http POST /api/token/101010101/11223344
```

If everything's fine you would get a response like that:

```
{
    "id": "1a2346c48ee342367d0e6af3c155b744",
    "token": "0c32d64ac6f348cfae7e441f317fd898",
    "userId": 101010101
}
```

Finally you are to set both the `userId` and the received `token` to environment variables:

```shell
export USER_TOKEN=0c32d64ac6f348cfae7e441f317fd898
export USER_ID=101010101
```

Now stop and restart API server and you should be able to use all the rest of the API methods

## REST API Methods

### POST /api/auth/:userId

```json
{
    "userId": userId
}
```  

### POST /api/token/:userId/:authCode

```json
{
    "id": "1a2346c48ee342367d0e6af3c155b744",
    "token": "0c32d64ac6f348cfae7e441f317fd898",
    "userId": userId
}
``` 

### GET /api/profile/:userId

```json
{
    "profile": {
        "atk": 90,
        "castle": "🐢",
        "class": "⚗️",
        "def": 95,
        "exp": 35982,
        "gold": 16,
        "guild": "13-й Галеон",
        "guild_tag": "13G",
        "lvl": 28,
        "mana": 531,
        "pouches": 79,
        "stamina": 20,
        "userName": "Кузоман"
    },
    "userId": userId
}
```

### GET /api/stock/:userId

```json
{
    "stock": {
        "Ash Rosemary": 2,
        "Astrulic": 2,
        "Bone": 7,
        "Bone powder": 50,
        "Bottle of Mana": 2,
        "Hunter Armor part": 1,
        "Hunter Dagger recipe": 1,
        "Powder": 649,
        "Queen's Pepper": 39,
        "Remedy pack": 3,
        "Thread": 107,
        "Leather": 20,
        "Pelt": 4,
        "Vial of Mana": 1,
        "Vial of Nature": 11,
        "Vial of Twilight": 4,
        "White Blossom": 82,
        "Wolf Root": 16,
        "Wrapping": 3,
        "Yellow Seed": 152,
        "Zombie Chest": 1,
        "🎟Gift Coupon 'Owl'": 1,
        "📕Scroll of Peace": ,
        "📕Scroll of Rage": 3,
        "📗Rare scroll of Peace": 1
    },
    "userId": userId
}
```

### GET /api/info

```json
{
    "status": "NotRegistered"
}
```

### POST /api/buy/:itemCode?:userId&:quantity&:price

Method does `exactMatch:true` requests

> ⚠️ If you regullary do a noticeable amount of over-the-marked priced buys they would revoke CW API credentials from you

Sample result assuming quantity is 1 and itemCode is 07

```json
{
    "itemName": "Powder",
    "quantity": 1,
    "userId": userId
}
```

## HTTP Error responses

```
HTTP/1.1 404 Not Found
Content-Length: 20
Content-Type: text/plain; charset=utf-8

NoOffersFoundByPrice
```

```
HTTP/1.1 404 Not Found
Content-Length: 10
Content-Type: text/plain; charset=utf-8

NoSuchUser
```

```
HTTP/1.1 401 Unauthorized
Content-Length: 11
Content-Type: text/plain; charset=utf-8

InvalidCode
```

```
HTTP/1.1 401 Unauthorized
Content-Length: 12
Content-Type: text/plain; charset=utf-8

InvalidToken
```

```
HTTP/1.1 502 Bad Gateway
Content-Length: 12
Content-Type: text/plain; charset=utf-8

BattleIsNear
```

```
HTTP/1.1 502 Bad Gateway
Content-Length: 10
Content-Type: text/plain; charset=utf-8

UserIsBusy
```

```
HTTP/1.1 404 Not Found
Content-Length: 17
Content-Type: text/plain; charset=utf-8

InsufficientFunds
```
