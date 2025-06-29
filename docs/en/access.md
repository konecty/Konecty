# Konecty Access

In Konecty, access permissions to modules and data can be managed in the following ways:

- User Access
- Module Access
- Groups and User filters

## User Access

The user's access field describes which modules will be visible in the user's menu.

The access field is usually inherited from the Role to the User.

Example of access in a Role:

```json
{
  "name": "Client",        // Role name
  "access": {              // field that will be inherited by the user
    "defaults": [          // name of the Access used for module permissions, any module not listed below uses this value
      "Client"
    ],
    "Task": "Manager",      // name of the Access used for the specific module
    "Contact": false,  
    "User": false          // false hides the user menu
  }
}
```

The access processing will follow this order:

1. Check if the module has a specific access configured; if so, that value is used.

- 1a. If the specific access is false, the module will be hidden and no further processing is done
- 1b. It looks for an access for the module with that name (e.g., {_id: Task:access:Manager, type: access, document: Task, name: Manager}, as described below)
- 1c. It looks for a default access with that name (e.g., {_id: Default:access:Manager, type: access, document: Default, name: Manager}, as described below)
- 1d. If no access is found, the module will be hidden and have no read permissions. No further processing is done.

2. If there is no specific access listed, the defaults list is traversed and the first valid access found is used, trying to find an access for the module or a default access.

3. If no valid access is found, the module will be hidden and have no read permissions.

* In the future, an access with isReadable: false will hide the module from the menu but allow other operations (create, update, delete) via API.


## Module Access

Each module can have one or more objects describing different types of access, which will be linked to the references mentioned above.

It is common practice for accesses to have names associated with Roles, but this is not mandatory.

```javascript
{
  // metadata descriptive fields, _id must be formed by document:type:name
  "_id": "Task:access:Client",
  "document": "Task",
  "type": "access",
  "name": "Client",
  "label": {
    "en": "Client",
    "pt_BR": "Client"
  },

  // permission for operations on documents of this module
  "isCreatable": true,      // can/cannot create new
  "isReadable": true,       // can/cannot view
  "isUpdatable": true,      // can/cannot update
  "isDeletable": false,     // can/cannot delete 

  // special read permission,
  // the document must meet this special filter to be visible to the user
  "readFilter": {
    "match": "or",
    "conditions": [
      {
        "term": "status",
        "operator": "equals",
        "value": "Ativo"
      }
    ]
  },
  "updateFilter": { },    // same format as readFilter
  "deleteFilter": { },    // same format as readFilter

  // 'default' permission for operations on fields of this module, usually modified field by field below
  "fieldDefaults": {
    "isCreatable": false,
    "isUpdatable": false,
    "isReadable": false,
    "isDeletable": false
  },

  // field operation permissions
  // when true, they can have a `condition` with an extra instruction to filter the permission
  "fields": {
    "code": {
      "CREATE": {
        "allow": true
      },
      "READ": {
        "allow": true
      },
      "UPDATE": {
        "allow": false
      },
      "DELETE": {
        "allow": false
      }
    },
    "title": {
      "CREATE": {
        "allow": true
      },
      "READ": {
        "allow": true
      },
      "UPDATE": {
        "allow": true,
        "condition":{
          "term": "status",
          "operator": "not_equals",
          "value": "Ativo" 
        }
      },
      "DELETE": {
        "allow": true
      }
    }
  },

  // export permissions. Defines export in html, pdf or xls and can allow exports of "view", "list" or "pivot"
  "export": {
    "html": [
      "view"
    ],
    "pdf": [
      "view"
    ],
    "xls": [
      "list",
      "pivot"
    ]
  },

  // User operation permissions. Controls the user change widget in the interface, but does not prevent operations via API
  "changeUserFilter": {
    "match": "or",
    "conditions": [
      {
        "term": "group._id",
        "value": "$group",
        "operator": "in"
      }
    ]
  },
  "changeUser": true,
  "replaceUser": true,
  "addUser": true,
  "removeUser": true,
  "defineUser": true,
  "removeInactiveUser": true,
}
```

### Default Accesses

There is a default access configuration that will be used for modules that do not have a specific access defined.

```
{
  "_id": "Default:access:Default",
  "document": "Default",
  "type": "access",
  "name": "Default",
  "isCreatable": false,
  "isReadable": false,
  "isUpdatable": false,
  "isDeletable": false
}
```

This way it is possible to define an admin access that has full access to all modules and fields.

```
{
  "_id": "Default:access:Full",
  "name": "Full",
  "type": "access",
  "document": "Default",
  "isCreatable": true,
  "isReadable": true,
  "isUpdatable": true,
  "isDeletable": true,
  "fieldDefaults": {
    "isCreatable": true,
    "isUpdatable": true,
    "isReadable": true,
    "isDeletable": true
  },
  "changeUser": true,
  "replaceUser": true,
  "addUser": true,
  "removeUser": true,
  "defineUser": true,
  "removeInactiveUser": true
}
```

With the user or role configured to use Full access, all modules and fields will be available.
```
{
  ...
  "access": {
    "defaults": [
      "Full"
    ]
  }
}
```

## Special values

There are some special values that can be used in access filters that will be computed according to the User and the moment of access: `$user`, `$group`, `$groups`, `$allgroups`, `$now`

```
conditions: [
  {
    "term": "_createdBy",
    "operator": "equals",
    "value": "$user"          // represents the same user, as _id
  },
]
```

```
conditions: [
  {
    "term": "_user.group._id",
    "operator": "equals",
    "value": "$group"          // represents the user group, as filled in the "group" field, as _id
  },
]
```

```
conditions: [
  {
    "term": "_user.group._id",
    "operator": "in",
    "value": "$allgroups"     // represents all user groups, 
			     // accumulating the values filled in the "group" and "groups" fields, as _ids
  },
]
```

```
conditions: [
  {
    "term": "activatedAt",
    "operator": "between",
    "value": {
	"lesser_than": "$now"   // computes the current date and time of the query
    }
  },
]
```


## Specific accesses for lookups

A lookup field of a document can use a specific access that overrides the user's access for the lookup search.
This way, a user who normally does not have access to that module's data may be able to select records within the scope of that lookup.

```
{
    "access": "Estimators", // uses the access settings of _id User:access:Estimators
    "document": "User",
    "descriptionFields": [
        "name",
        "group.name"
    ],
    "type": "lookup",
    "name": "estimator",
    "label": {
        "en": "Estimator",
        "pt_BR": "Orçamentista"
    },
    
}
``` 