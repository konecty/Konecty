# Resources and Events Configuration

## Queue Resources Configuration

The queue resources configuration allows you to define message queue connections and their settings. This is typically used for event handling and asynchronous processing.

### Basic Structure

```json
{
	"resources": {
		"resourceName": {
			"type": "rabbitmq",
			"url": "amqp://localhost",
			"queues": [
				{
					"name": "queue1",
					"driverParams": {}
				}
			]
		}
	},
	"konsistent": ["resourceName", "queueName"]
}
```

### Properties

-   `resources`: A record of named resources, each containing:
    -   `type`: Currently only supports `"rabbitmq"`
    -   `url`: Connection URL for the queue service
    -   `queues`: Array of queue configurations:
        -   `name`: Queue name
        -   `driverParams`: Optional driver-specific parameters
            -   `delayed`: Optional boolean to enable delayed message delivery
            -   `exchangeName`: Optional exchange name to use for sending the message
            -   `routingKey`: Optional routing key to use for sending the message
			-   `exchangeType`: Optional exchange type to use for sending the message
			-   `exchangeOptions`: Optional exchange options to use for sending the message
			-   `others`: Optional other driver-specific parameters
-   `konsistent`: Optional tuple of [resourceName, queueName] for Konsistent service configuration

## Document Events

Document events allow you to define actions that should be triggered when certain conditions are met in your documents.

### Basic Structure

```json
{
	"events": [
		{
			"name": "eventName",
			"event": {
				"type": "queue",
				"queue": "queueName",
				"resource": "resourceName",
				"sendOriginal": false,
				"sendFull": false
			},
			"conditions": {
				"all": [
					{
						"fact": "status",
						"operator": "equal",
						"value": "active"
					}
				]
			}
		}
	]
}
```

### Event Types

#### Queue Event

-   `type`: "queue"
-   `queue`: String or array of queue names
-   `resource`: Resource name from queue configuration
-   `sendOriginal`: Optional boolean to send original document state
-   `sendFull`: Optional boolean to send full document data
-   `delay`: Optional number of milliseconds to delay message delivery (requires delayed exchange configuration)
-   `exchangeName`: Optional exchange name to use for sending the message
-   `routingKey`: Optional routing key to use for sending the message

#### Webhook Event

-   `type`: "webhook"
-   `url`: Webhook URL
-   `headers`: Optional record of HTTP headers
-   `method`: Optional HTTP method
-   `sendOriginal`: Optional boolean to send original document state
-   `sendFull`: Optional boolean to send full document data

### Conditions

Conditions use the [json-rules-engine](https://github.com/CacheControl/json-rules-engine/blob/master/docs/rules.md) format:

-   `all`: Array of conditions that must all be true
-   `any`: Array of conditions where at least one must be true
-   `not`: Condition that must be false

Each condition can include:

-   `fact`: The field to evaluate
-   `operator`: Comparison operator
-   `value`: Value to compare against

### Data format

The data comes in the following format, the keys can be used as facts:
`{ metaName, operation, data, original?, full? }`

### Pre-defined Conditions

The system provides several pre-defined conditions for common use cases:

-   `has-id`: Checks if the document has an `_id` field - allways triggers
-   `operation:create`: Matches when the operation is a document creation
-   `operation:update`: Matches when the operation is a document update
-   `operation:delete`: Matches when the operation is a document deletion

Usage: `{ "conditions": { "all": [{ "condition": "operation:create" }] } }`

### Custom Operators

In addition to the standard operators, the following custom operators are available:

-   `hasKey`: Checks if an object has a specific key or nested key path

    ```json
    {
    	"fact": "data",
    	"operator": "hasKey",
    	"value": "address.street"
    }
    ```

-   `hasKeys`: Checks if an object has any of the specified keys or nested key paths
    ```json
    {
    	"fact": "data",
    	"operator": "hasKeys",
    	"value": ["address.street", "address.city"]
    }
    ```

The `path` property supports JSONPath expressions to navigate complex document structures.

### Accessing Nested Data

When using `sendOriginal: true` or `sendFull: true`, you can access nested data in conditions using path expressions:

```json
{
    "fact": "full",
    "path": "$._user.0._id",
    "operator": "equal",
    "value": "some-user-id"
}
```
