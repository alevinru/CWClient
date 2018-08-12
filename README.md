# CWClient

ChatWars REST API server

This api doesn't authorize client requests so isn't intended to be publicly accessible.

The api server may be hosted privately to serve as a backend responding internally to another authorized api.

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

### POST /auth/:userId

```json
{
    "userId": userId
}
```  

### POST /token/:userId/:authCode

```json
{
    "id": "1a2346c48ee342367d0e6af3c155b744",
    "token": "0c32d64ac6f348cfae7e441f317fd898'",
    "userId": userId
}
``` 

### GET /profile/:userId

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

### GET /stock/:userId

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

### GET /info

```json
{
    "status": "NotRegistered"
}
```

### POST /buy/:itemCode?:userId&:quantity&:price

Sample result assuming quantity is 1 and itemCode is 07

```json
{
    "itemName": "Powder",
    "quantity": 1,
    "userId": userId
}
```
