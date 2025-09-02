const config = {};

config.dev = {
    "admin": {
        users: [{
            username: "demo",
            password: "password-hash", 
            permissions: "*"
        }]
    },
    "server": { 
        "host": "https://your.dev.host/",
        "path": "/bot1",
        "verbose": true,
        "key": "cCsUQ0oxcVqTTaxsXWj5gf2AOCqhSayw8vaGaQKf",
        "contextLRU": 10000
    }
};

module.exports = config;