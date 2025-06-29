# Hooks

Hooks are functions that can be executed before, during, or after an update or create in Konecty.

Information

- Each hook is a script that runs in an isolated Node.js sandbox
- All scripts run in an isolated context with access to global variables, but without access to any external resources except those provided
- All hooks have implicit access to the JavaScript console. Execution logs can be found in Konecty's logs
- Script editing is done in the client's metadata repository
- No hook is mandatory and they are not linked to each other


Below are the available hooks:

## Before Validation
    - metadata: `scriptBeforeValidation`

**When it runs**
The first in the script line. Runs on any data mutation (update and create)

**Purpose**
Used to modify data before it is saved (and prepared for validation) in the database

**Return**
Returns an object that will be merged with the record to be edited/created

**How to use**

The script is invoked as a function receiving the following parameters:

| Parameter | Description |
|-----------|-------------|
| data | Contains the entire record being modified |
| emails | Empty array to be filled with emails to send |
| user | Contains the user making the change |
| extraData | Object with the properties **original** (the original record, without changes, empty object on creation) and **request** (the data sent in the update) |

```ts
const sandbox = createContext(contextData);
const scriptToRun = `result = (function(data, emails, user, console) { ${script} })(data, emails, user, console);`;
await runInContext(scriptToRun, sandbox);
```

An example of use:

```ts
var ret = {};
var original = extraData.original;
var currentDate = new Date();
var record = data;

// If the status value was Active and changed to Inactive, add the deactivation date
if (data.status === 'Inactive' && original.status == 'Active') {
    ret.deactivatedAt = currentDate;
}

// If the status value was changed to Success, clear errorLogs
if (data.status !== original.status && data.status === 'Success') {
    ret.errorLogs = null;
}

return ret;
```

## Validation
    - metadata: `validationScript` and `validationData`

**When it runs**
The second hook to execute. Runs after all data for the operation has already been computed

**Purpose**
Used to modify data before it is saved in the database

**Return**
Returns an object indicating whether the operation is valid and the reason if it is not

**How to use**

The script is invoked as a function receiving the following parameters:

| Parameter | Description |
|-----------|-------------|
| data | Contains the entire record being modified, with the data already processed |
| user | Contains the user making the change |
| extraData | Object with the properties defined in validationData. |
| **validationData** | Filter defined in the metadata for Konecty to fetch data from the database and deliver to the script |

The validation data is also defined in the metadata and must be an object in the following format:

```ts
"validationData": {
    "original": {
        "field": "_id, status",
        "document": "Product",
        "filter": {
            "match": "and",
            "conditions": [
                {
                    "term": "_id",
                    "operator": "equals",
                    "value": "$this._id"
                }
            ]
        }
    }
}
```

The validation data is used to fetch data from the database and deliver it to the script.

An example of script use:

```ts
var original = ((extraData || {}).original || {})[0] || {};

// If the user is not admin, it is not allowed to update the status to "Active"
if ( user.role.name != 'Admin' && original.status !== 'Active' && data.status === 'Active') {
    return {
        "success": false,
        "reason": "User does not have permission to update status to Active"
    }
}

return {
    "success": true
}
```


## After Save
    - metadata: `scriptAfterSave`

**When it runs**
Last hook to execute. Runs after the data has already been saved, just before returning to the user

**Purpose**
Used for operations that require a guarantee that the operation was completed

**Return**
No return

**How to use**

The script is invoked as a function receiving the following parameters:

| Parameter | Description |
|-----------|-------------|
| data | Array. Contains the entire records already modified |
| extraData | Contains the user making the change |
| user | Object with the properties original (the original record, without changes, undefined on creation) |
| Models | Object with all Konecty collections, indexed by the metadata name. Ex: Models["Product"] |

```ts
const scriptAfterSave = async (data, extraData, user, Models) => {
    eval(scriptAfterSave);
}
```

An example of use:

```ts
if (data && data.length > 0) {
    for (index in data) {
        var original = null;
        if (extraData && extraData['original'] && extraData['original'][index]) {
            original = extraData['original'][index];
        }
        var record = data[index];

        request.post({
            url: 'https://api.example.com/endpoint',
            body: {
                _id: record._id,
            },
            json: true,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        await Models['Development'].updateOne({_id: '1234567890'}, {$set: {synced: true}});
    }
}
```

## Requests

The `scriptAfterSave` hook has access to an object called `request` that can be used to make HTTP requests.

The request object has the following methods:

- `post({url, body, json, headers})` 