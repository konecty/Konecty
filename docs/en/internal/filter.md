# Konecty Filters

This guide was developed to help you quickly and efficiently start creating filters in Konecty.

## What are Filters?

Filters in Konecty are structures that allow you to search and filter data according to specific criteria. They are used in various parts of the system, such as:
- Lists
- Reports
- Automations
- Business Rules

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
                    "term": "status",    // Field to filter
                    "value": [           // Value or array of values
                        "New",
                        "In+Progress"
                    ],
                    "operator": "in"     // Comparison operator
                }
            ]
        },
        {
            "match": "and",
            "conditions": [
                {
                    "term": "_user._id", // Nested fields using dot notation
                    "value": "$user",    // Special values start with $
                    "operator": "equals"
                }
            ]
        }
    ]
}
```

### Nested Filters Characteristics

1. **Nesting Levels**
   - You can nest filters in multiple levels
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

### Practical Nested Filter Example

Search for opportunities that:
- Are new or in progress
- And belong to the current user
- Or have value greater than 10000

```json
{
    "match": "or",
    "filters": [
        {
            "match": "and",
            "conditions": [
                {
                    "term": "status",
                    "value": ["New", "In+Progress"],
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

## First Steps

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
Now, let's search for active contacts from the state of California:

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
            "value": "CA"
        }
    ]
}
```

### 3. Using OR
Search for contacts from California OR New York:

```json
{
    "match": "or",
    "conditions": [
        {
            "operator": "equals",
            "term": "address.state",
            "value": "CA"
        },
        {
            "operator": "equals",
            "term": "address.state",
            "value": "NY"
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

### 1. Search Recent Opportunities
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
            "value": "1"
        }
    ]
}
```

### 3. Search by Owner
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
- Use `$groups` for the current user's secondary groups
- Use `$allgroups` for all user's groups (main and secondary)
- Use `$today`, `$yesterday`, `$startOfWeek`, `$startOfMonth`, `$startOfYear` for start-of-period dates
- Use `$endOfDay`, `$endOfWeek`, `$endOfMonth`, `$endOfYear` for end-of-period dates
- Use `$hoursAgo:N`, `$daysAgo:N`, `$monthsAgo:N` for relative past dates
- Use `$hoursFromNow:N`, `$daysFromNow:N`, `$monthsFromNow:N` for relative future dates

### Nested Fields
To access fields within objects, use dots:
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

### Special Variables ($)

Konecty provides special variables that can be used in filters for dynamic references:

- **`$user`**: Current user ID
  ```json
  {
      "operator": "equals",
      "term": "owner._id",
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

- **`$groups`**: Array of current user's secondary group IDs
  ```json
  {
      "operator": "in",
      "term": "groups._id",
      "value": "$groups"
  }
  ```

- **`$allgroups`**: Array of all user's groups (main and secondary)
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

All resolved in `parseConditionValue` at `src/imports/data/filterUtils.js`:

| Variable | Resolves to |
|----------|-------------|
| `$today` | Start of current day (00:00:00.000) |
| `$yesterday` | Start of previous day (00:00:00.000) |
| `$startOfWeek` | Monday of current week (00:00:00.000) |
| `$startOfMonth` | 1st of current month (00:00:00.000) |
| `$startOfYear` | Jan 1 of current year (00:00:00.000) |
| `$endOfDay` | End of current day (23:59:59.999) |
| `$endOfWeek` | Sunday of current week (23:59:59.999) |
| `$endOfMonth` | Last day of current month (23:59:59.999) |
| `$endOfYear` | Dec 31 of current year (23:59:59.999) |
| `$hoursAgo:N` | N hours before now (exact time) |
| `$hoursFromNow:N` | N hours after now (exact time) |
| `$daysAgo:N` | N days ago at 00:00:00.000 |
| `$daysFromNow:N` | N days from now at 00:00:00.000 |
| `$monthsAgo:N` | N months ago at 00:00:00.000 |
| `$monthsFromNow:N` | N months from now at 00:00:00.000 |

These variables are available in all filter contexts (find, findStream, graphStream, pivotStream, kpiStream).

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

## Common Issues

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

### 2. Invalid Operator for Type
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

### 3. Non-existent Field
❌ Wrong:
```json
{
    "term": "direccion.ciudad"
}
```

✅ Correct:
```json
{
    "term": "address.city"
}
```

## Next Steps

1. Start with simple filters and gradually increase complexity
2. Use the browser console to test filters
3. Check the complete documentation for specific cases
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
- `_user`: Owner user
- `status`: Record status
- `name`: Name
- `email`: Email
- `phone`: Phone 