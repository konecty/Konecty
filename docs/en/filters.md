# Filters in Konecty

This guide was developed to help you start creating filters in Konecty quickly and efficiently.

## What are Filters?

Filters in Konecty are structures that allow you to search and filter data according to specific criteria. They are used in various parts of the system, such as:
- Listings
- Reports
- Automations
- Business rules

## Basic Structure

Every filter in Konecty follows this basic structure:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "field",
            "value": "value"
        }
    ]
}
```

Where:
- `match`: Defines how multiple conditions relate ("and" or "or")
- `conditions`: List of filter conditions
- Each condition has:
  - `operator`: The type of comparison
  - `term`: The field to be compared
  - `value`: The value for comparison

## Nested Filters

Konecty supports nested filters, allowing you to create more complex logic by combining multiple filters:

```json
{
    "match": "or",           // Logical operator between filters: "or" or "and"
    "filters": [             // Array of sub-filters
        {
            "match": "and",  // Logical operator between conditions
            "conditions": [   // Array of conditions
                {
                    "term": "status",    // Field to be filtered
                    "value": [           // Value or array of values
                        "New",
                        "In Progress"
                    ],
                    "operator": "in"     // Comparison operator
                }
            ]
        },
        {
            "match": "and",
            "conditions": [
                {
                    "term": "_user._id", // Nested fields using dot
                    "value": "$user",    // Special values start with $
                    "operator": "equals"
                }
            ]
        }
    ]
}
```

### Features of Nested Filters

1. **Nesting Levels**
   - You can nest filters at multiple levels
   - Each level can have its own logical operator (`match`)
   - There is no theoretical limit to the number of levels

2. **Combining Conditions**
   - Use `match: "and"` when all conditions must be true
   - Use `match: "or"` when any condition can be true
   - Mix `and` and `or` at different levels for complex logic

3. **Structure**
   - `filters`: Array of sub-filters
   - Each sub-filter can contain:
     - `match`: Logical operator
     - `conditions`: Direct conditions
     - `filters`: More sub-filters

### Practical Example of Nested Filter

Search for opportunities that:
- Are new or in progress
- And belong to the current user
- Or have a value greater than 10000

```json
{
    "match": "or",
    "filters": [
        {
            "match": "and",
            "conditions": [
                {
                    "term": "status",
                    "value": ["New", "In Progress"],
                    "operator": "in"
                },
                {
                    "term": "_user._id",
                    "value": "$user",
                    "operator": "equals"
                }
            ]
        },
        {
            "match": "and",
            "conditions": [
                {
                    "term": "value.value",
                    "value": 10000,
                    "operator": "greater_than"
                }
            ]
        }
    ]
}
```

## Getting Started

### 1. Simple Filter
Let's start with a simple filter that searches for active contacts:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "status",
            "value": "Active"
        }
    ]
}
```

### 2. Combining Conditions
Now, let's search for active contacts from the state of São Paulo:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "status",
            "value": "Active"
        },
        {
            "operator": "equals",
            "term": "address.state",
            "value": "SP"
        }
    ]
}
```

### 3. Using OR
Search for contacts from Rio de Janeiro OR São Paulo:

```json
{
    "match": "or",
    "conditions": [
        {
            "operator": "equals",
            "term": "address.state",
            "value": "SP"
        },
        {
            "operator": "equals",
            "term": "address.state",
            "value": "RJ"
        }
    ]
}
```

## Common Operators

### Equality
```json
{
    "operator": "equals",
    "term": "name",
    "value": "John Smith"
}
```

### Contains Text
```json
{
    "operator": "contains",
    "term": "name",
    "value": "Smith"
}
```

### Greater/Less Than
```json
{
    "operator": "greater_than",
    "term": "age",
    "value": 18
}
```

### List of Values
```json
{
    "operator": "in",
    "term": "status",
    "value": ["Active", "Pending", "Under Review"]
}
```

## Practical Examples

### 1. Search for Recent Opportunities
```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "greater_than",
            "term": "_createdAt",
            "value": {
                "$date": "2024-01-01T00:00:00.000Z"
            }
        },
        {
            "operator": "in",
            "term": "status",
            "value": ["New", "In Progress"]
        }
    ]
}
```

### 2. Filter Contacts by Phone and Email
```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "exists",
            "term": "email",
            "value": true
        },
        {
            "operator": "starts_with",
            "term": "phone.phoneNumber",
            "value": "11"
        }
    ]
}
```

### 3. Search by Responsible
```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "_user._id",
            "value": "$user"
        }
    ]
}
```

## Tips and Tricks

### Special Values
- Use `$user` to reference the current user
- Use `$now` for the current date and time
- Use `$group` for the current user's group
- Use `$groups` for the current user's groups
- Use `$allgroups` for all groups of the current user
- Use `$today`, `$yesterday`, `$startOfMonth`, etc. for dynamic date boundaries
- Use `$endOfDay`, `$endOfMonth`, etc. for end-of-period boundaries
- Use `$daysAgo:N`, `$hoursAgo:N`, `$monthsAgo:N` for relative past dates
- Use `$hoursFromNow:N`, `$daysFromNow:N`, `$monthsFromNow:N` for relative future dates

### Nested Fields
To access fields within objects, use dot notation:
- `address.city`
- `contact.name.first`
- `opportunity.value.currency`

### Date Filters
Always use ISO format for dates:
```json
{
    "operator": "equals",
    "term": "birthDate",
    "value": {
        "$date": "1990-01-01T00:00:00.000Z"
    }
}
```

## Common Problems

### 1. Incorrect Date Format
❌ Wrong:
```json
{
    "value": "2024-01-01"
}
```

✅ Correct:
```json
{
    "value": {
        "$date": "2024-01-01T00:00:00.000Z"
    }
}
```

### 2. Invalid Operator for the Type
❌ Wrong:
```json
{
    "operator": "contains",
    "term": "age",
    "value": "2"
}
```

✅ Correct:
```json
{
    "operator": "equals",
    "term": "age",
    "value": 2
}
```

### 3. Nonexistent Field
❌ Wrong:
```json
{
    "term": "endereco.cidade"
}
```

✅ Correct:
```json
{
    "term": "address.city"
}
```

## Next Steps

1. Try creating simple filters and gradually increase complexity
2. Use the browser console to test filters
3. Check the full documentation for specific cases
4. Practice combining different operators

## Quick References

### All Operators

| Operator | Description |
|----------|-------------|
| `equals` | Equal to |
| `not_equals` | Not equal to |
| `contains` | Contains (substring) |
| `not_contains` | Does not contain |
| `starts_with` | Starts with |
| `end_with` | Ends with |
| `less_than` | Less than |
| `greater_than` | Greater than |
| `less_or_equals` | Less than or equal to |
| `greater_or_equals` | Greater than or equal to |
| `between` | Between two values |
| `in` | Is in list |
| `not_in` | Is not in list |
| `exists` | Field exists (true) or does not exist (false) |
| `current_user` | Field is the current user |
| `not_current_user` | Field is not the current user |
| `current_user_group` | Field is the current user's group |
| `not_current_user_group` | Field is not the current user's group |
| `current_user_groups` | Field is in the current user's groups |

### Operators by Field Type

#### Text (`text`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### URL (`url`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Email (`email.address`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Number (`number`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Auto Number (`autoNumber`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Percentage (`percentage`)
`exists`, `equals`, `not_equals`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Date (`date`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Date and Time (`dateTime`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Time (`time`)
`exists`, `equals`, `not_equals`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Money — Currency (`money.currency`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Money — Value (`money.value`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Boolean (`boolean`)
`exists`, `equals`, `not_equals`

#### Picklist (`picklist`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Lookup (`lookup`)
`exists`

#### Lookup ID (`lookup._id`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### ObjectId
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Address — Country (`address.country`)
`exists`, `equals`, `not_equals`

#### Address — City (`address.city`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Address — State (`address.state`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Address — District (`address.district`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Address — Place (`address.place`)
`exists`, `equals`, `not_equals`, `contains`

#### Address — Number (`address.number`)
`exists`, `equals`, `not_equals`

#### Address — Postal Code (`address.postalCode`)
`exists`, `equals`, `not_equals`, `contains`

#### Address — Complement (`address.complement`)
`exists`, `equals`, `not_equals`, `contains`

#### Address — Geolocation (`address.geolocation.0`, `address.geolocation.1`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Person Name (`personName.first`, `personName.last`, `personName.full`)
`exists`, `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Phone — Number (`phone.phoneNumber`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Phone — Country Code (`phone.countryCode`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Encrypted (`encrypted`)
`exists`, `equals`, `not_equals`

#### Filter (`filter`)
`exists`

#### Rich Text (`richText`)
`exists`, `contains`

#### File (`file`)
`exists`

### Common Fields
- `_id`: Record ID
- `_createdAt`: Creation date
- `_updatedAt`: Update date
- `_user`: Responsible user
- `status`: Record status
- `name`: Name
- `email`: Email
- `phone`: Phone

### Special Variables ($)

Konecty offers special variables that can be used in filters for dynamic references:

- **`$user`**: Current user's ID
  ```json
  {
      "operator": "equals",
      "term": "responsible._id",
      "value": "$user"
  }
  ```

- **`$group`**: Current user's main group ID
  ```json
  {
      "operator": "equals",
      "term": "group._id",
      "value": "$group"
  }
  ```

- **`$groups`**: Array with the current user's secondary group IDs
  ```json
  {
      "operator": "in",
      "term": "groups._id",
      "value": "$groups"
  }
  ```

- **`$allgroups`**: Array with all groups (main and secondary) of the current user
  ```json
  {
      "operator": "in",
      "term": "groups._id",
      "value": "$allgroups"
  }
  ```

- **`$now`**: Current date and time
  ```json
  {
      "operator": "less_than",
      "term": "dueDate",
      "value": "$now"
  }
  ```

- **`$user.field`**: Access to specific fields of the current user
  ```json
  {
      "operator": "equals",
      "term": "branch._id",
      "value": "$user.branch._id"
  }
  ```

#### Dynamic Date Variables

Konecty provides dynamic date variables that are resolved at query time. These variables work in all filter contexts: listings, pivot tables, graphs, KPI widgets, and form filter fields.

**Start of period (00:00:00.000):**

| Variable | Description | Example |
|----------|-------------|---------|
| `$today` | Start of the current day | `00:00:00.000` of today |
| `$yesterday` | Start of the previous day | `00:00:00.000` of yesterday |
| `$startOfWeek` | Monday of the current week | Monday at `00:00:00.000` |
| `$startOfMonth` | First day of the current month | 1st at `00:00:00.000` |
| `$startOfYear` | January 1st of the current year | Jan 1 at `00:00:00.000` |

**End of period (23:59:59.999):**

| Variable | Description | Example |
|----------|-------------|---------|
| `$endOfDay` | End of the current day | `23:59:59.999` of today |
| `$endOfWeek` | Sunday of the current week | Sunday at `23:59:59.999` |
| `$endOfMonth` | Last day of the current month | Last day at `23:59:59.999` |
| `$endOfYear` | December 31st of the current year | Dec 31 at `23:59:59.999` |

**Parametric relative (past):**

| Variable | Description | Example |
|----------|-------------|---------|
| `$hoursAgo:N` | N hours ago from now | `$hoursAgo:3` = 3 hours ago |
| `$daysAgo:N` | N days ago at `00:00:00.000` | `$daysAgo:7` = 7 days ago |
| `$monthsAgo:N` | N months ago at `00:00:00.000` | `$monthsAgo:1` = last month |

**Parametric relative (future):**

| Variable | Description | Example |
|----------|-------------|---------|
| `$hoursFromNow:N` | N hours from now | `$hoursFromNow:3` = in 3 hours |
| `$daysFromNow:N` | N days from now at `00:00:00.000` | `$daysFromNow:1` = tomorrow |
| `$monthsFromNow:N` | N months from now at `00:00:00.000` | `$monthsFromNow:1` = in 1 month |

##### Examples

Records created this month:
```json
{
    "operator": "greater_or_equals",
    "term": "_createdAt",
    "value": "$startOfMonth"
}
```

Records due before end of today:
```json
{
    "operator": "less_or_equals",
    "term": "dueDate",
    "value": "$endOfDay"
}
```

Records created in the last 7 days:
```json
{
    "operator": "greater_or_equals",
    "term": "_createdAt",
    "value": "$daysAgo:7"
}
```

Records updated in the last 3 hours:
```json
{
    "operator": "greater_or_equals",
    "term": "_updatedAt",
    "value": "$hoursAgo:3"
}
```

#### Example Combining Special Variables

Search for records that belong to the current user's group and were created this month:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "group._id",
            "value": "$group"
        },
        {
            "operator": "greater_or_equals",
            "term": "_createdAt",
            "value": "$startOfMonth"
        }
    ]
}
``` 