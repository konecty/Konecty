# LOGIN

`curl https://[domain]/rest/auth/login -H "Content-Type: application/json" -d '{"user": "_LOGIN_", "password_SHA256": "_PASSWORD_SHA_256_", "ns": "[NAMESPACE]"}'`

results in

```
{
    "success": true,
    "logged": true,
    "authId": "abcdefghijklmnopqrstuvwxyz=",
    "user": (...)
}
```

where `authId` should be stored for using in following requests.

# SAVING LEADS

`curl https://[domain]/rest/process/submit -H "Content-Type: application/json" --cookie "authTokenId=_AUTH_ID_" -d '{"data": [{"name": "contact", "data": {"name": "Konecty Support", "email": "support@konecty.com", "phone": "5130855151"} } ] }'`

results in

```
{
    "success": true,
    "data": [{
        "_id": "abcdefghij",
        "_user": [ (...) ],
        "contactAttempts": 0,
        "invalidAttempts": 0,
        "type": ["Client"],
        "email": [{
            "address": "support@konecty.com"
        }],
        "name": {
            "first": "Konecty",
            "last": "Support",
            "full": "Konecty Support"
        },
        "status": "Lead",
        "code": (...),
        "_createdAt": (...),
        "_createdBy": (...),
        "_updatedAt": (...),
        "_updatedBy": (...)
    }]
}
```

# LIST PRODUCTS

`curl -G https://[domain]/rest/data/Product/find --cookie "authTokenId=_AUTH_ID_" -d 'filter={"match":"and","conditions":[{"term":"status","operator":"equals","value":"Ativo","editable":true,"disabled":false}]}'`

```
{
	"success": true,
	"data": [ (...) ], // Array of products
	"total": 506 // Total number of products after applying filter
}
```
