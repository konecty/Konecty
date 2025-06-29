## **1. Metadata**

### **Description**
Metadata defines the properties and validations of specific fields in the system. They are essential to ensure that data is captured and stored correctly.

The platform has an initial set of required metadata to start a server available at `/src/private/metadata`.
This set of metadata can be used together with this documentation as a reference for creating new modules, lists, and forms.

There are 5 distinct types of metadata: `document`, `access`, `list`, `view`, and `pivot`.

- **document**: describes the module, fields, and relationships with other modules. Mandatory for the existence of each module.
- **access**: configures access to module data. Each user has an access configuration for each module. Accesses are optional and can be defined by default.
- **list**: describes a module's list view, configuring filters and columns. There can be several different lists per module. The `list` metadata is optional for the server, but at least one `list` per module is required for the standard interface.
- **view**: describes a module's view and form where a record is editable or viewable in detail. Each `list` defines a `view` to open the record screen. This metadata is optional for the server, but at least one `view` per module is required for the standard interface.
- **pivot**: describes a pivot table report for each module, configuring filters, columns, rows, values, and aggregators. There can be multiple `pivot` for each module. The `pivot` metadata is optional.

## **Document**

A `document` object defines the structure, fields, validation rules, relationships, and settings of a data module on the platform. It serves as the main specification for how the module's data will be stored, displayed, and manipulated by the system. Each property of the object controls a fundamental aspect of the module's behavior, allowing flexibility and standardization in the creation of new modules.

Below are the main properties of a `document` object:

| Property      | Type         | Description                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Unique identifier of the module/document.                                                            |
| `fields`         | object       | Defines the module's fields, including type, validations, labels, relationships, and options.          |
| `icon`           | string       | Representative icon of the module, used in the interface.                                             |
| `label`          | object       | Module labels in different languages, for user-friendly display.                         |
| `menuSorter`     | number       | Defines the display order of the module in the interface menus.                                        |
| `name`           | string       | Technical name of the module/document, used internally by the system. Must be the same as `_id` |
| `plurals`        | object       | Pluralization of the module name in different languages, for use in lists and titles.                 |
| `saveHistory`    | boolean      | Indicates whether the module's change history should be saved.                                       |
| `type`           | string       | Metadata type, in this case always `"document"`.                                                   |
| `indexes`        | object       | Additional indexes for the module, optimizing searches and ensuring uniqueness of field combinations.|
| `sendAlerts`     | boolean      | Indicates whether the system should send alerts related to this module.                                 |

Each field within `fields` also has its own properties, such as `type`, `label`, `isRequired`, `isSortable`, among others, which detail the behavior and restrictions of each module attribute. These definitions allow the system to validate, display, and manipulate data consistently and flexibly, according to the needs of each module. The fields `_user`, `_createdAt`, `_createdBy`, `_updatedAt`, and `_updatedBy` are standard, must be present in all documents, and their settings should not be changed.


### Example of `document`
```json
// Example omitted for brevity. Please refer to the original file for the full JSON example.
```

## **List**

The `list` object defines how a module's records are presented in lists in the system interface. It specifies columns, filters, sorting, view options, pagination, and other aspects that control the user experience when viewing multiple records of a module. Each property of the object allows customizing the display, filtering, and interaction with the listed data.

| Property      | Type         | Description                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Unique identifier of the list, usually in the format `<Module>:list:<Name>`.                        |
| `document`       | string       | Name of the module/document to which the list belongs.                                                  |
| `type`           | string       | Metadata type, in this case always `"list"`.                                                      |
| `name`           | string       | Name of the list, used for internal reference and display.                                        |
| `label`          | object       | List labels in different languages, for user-friendly display.                          |
| `plurals`        | object       | Pluralization of the list name in different languages.                                                |
| `columns`        | object       | Defines the columns displayed in the list, their properties, and order.                                     |
| `filter`         | object       | Configuration of filters available for searching and segmenting records.                        |
| `sorters`        | array        | Default sorting applied to the list.                                                                |
| `rowsPerPage`    | object       | Options and default value for the number of records per page.                                        |
| `refreshRate`    | object       | Options and default value for automatic list refresh.                                           |
| `view`           | string       | Name of the view associated with the list, used for detailed record display.                    |
| `loadDataAtOpen` | boolean      | Indicates whether data should be loaded automatically when opening the list.                           |
| `calendars`      | array        | (Optional) Calendar view settings, if applicable.                    |

Each column defined in `columns` can contain properties such as `name`, `linkField`, `visible`, `minWidth`, `sort`, among others, which determine how each field will be displayed in the list. The filters in `filter` allow the user to segment and search records according to defined criteria.

### Example of `list`
```json
// Example omitted for brevity. Please refer to the original file for the full JSON example.
```

## **View**

The `view` object defines the structure and visual organization of forms and detail screens of a module. It specifies how fields and field groups are presented to the user, allowing customization of the record viewing and editing experience. Each property of the object controls aspects such as grouping, order, labels, styles, and types of visual components displayed.

| Property      | Type         | Description                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Unique identifier of the view, usually in the format `<Module>:view:<Name>`.                         |
| `document`       | string       | Name of the module/document to which the view belongs.                                                   |
| `type`           | string       | Metadata type, in this case always `"view"`.                                                      |
| `name`           | string       | Name of the view, used for internal reference and display.                                         |
| `label`          | object       | View labels in different languages, for user-friendly display.                           |
| `plurals`        | object       | Pluralization of the view name in different languages.                                                 |
| `visuals`        | array        | Hierarchical structure of groups, fields, and visual components displayed on the screen.                     |

Each item in `visuals` can be a group (`visualGroup`), a field (`visualSymlink`), or other types of visual components, allowing flexibility in the organization and presentation of data. Styles and additional properties control details such as icons, titles, rendering, and field behavior.

The `reverseLookup` type within `visuals` allows displaying a list of records from another module that have the current record as a value in a lookup field, facilitating the visualization of reverse relationships between modules.

### Example of `view`
```json
// Example omitted for brevity. Please refer to the original file for the full JSON example.
```


## **Pivot**

### General Description

The `pivot` object defines dynamic reports in pivot table format for a module. It allows configuring columns, rows, aggregated values, filters, and sorting, making it possible to flexibly analyze the module's data from different perspectives. Each property of the object controls an aspect of report generation and display, making it possible to create dashboards and custom analytical views.

| Property      | Type         | Description                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Unique identifier of the pivot, usually in the format `<Module>:pivot:<Name>`.                       |
| `document`       | string       | Name of the module/document to which the pivot belongs.                                                  |
| `type`           | string       | Metadata type, in this case always `"pivot"`.                                                     |
| `name`           | string       | Name of the pivot, used for internal reference and display.                                        |
| `label`          | object       | Pivot labels in different languages, for user-friendly display.                          |
| `plurals`        | object       | Pluralization of the pivot name in different languages.                                                |
| `columns`        | object       | Defines the columns of the pivot table, usually associated with module fields.                     |
| `rows`           | array        | Defines the rows of the pivot table, usually associated with module fields.                      |
| `values`         | array        | Configures the aggregated values (e.g., sum, count) displayed in the pivot table.                    |
| `filter`         | object       | Configuration of filters available for segmenting the analyzed data.                         |
| `sorters`        | array        | Default sorting applied to the report.                                                           |
| `rowsPerPage`    | object       | Options and default value for the number of records per page.                                        |
| `refreshRate`    | object       | Options and default value for automatic report refresh.                                       |
| `loadDataAtOpen` | boolean      | Indicates whether data should be loaded automatically when opening the report.                       |

Each item in `columns`, `rows`, and `values` can contain properties such as `name`, `linkField`, `label`, `aggregator`, among others, which determine how data will be grouped and aggregated in the pivot table. The filters in `filter` allow the user to segment the analyzed data according to defined criteria.

### Example of `pivot`
```json
// Example omitted for brevity. Please refer to the original file for the full JSON example.
```

## **Access, roles, and groups**

[Described in detail in ./access.md](./access.md)

## **Hooks**

[Described in detail in ./hooks.md](./hooks.md) 