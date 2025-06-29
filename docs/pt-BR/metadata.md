# Metadata

## Descrição
Metadados definem as propriedades e validações de campos específicos no sistema. Eles são essenciais para garantir que os dados sejam capturados e armazenados corretamente.

A plataforma tem um conjunto inicial de metadata necessários para iniciar um servidor disponíveis em `/src/private/metadata`.
Esse conjunto de metadata pode ser usado em conjunto com esta documentação como referência para criação de novos módulos, listas e formulários.

Existem 5 tipos de metadata distintos, `document`, `access`, `list`, `view` e `pivot`.

- **document**: descreve o módulo, campos e relacionamento com outros módulos. Obrigatório para existência de cada módulo.
- **access**: configura o acesso aos dados do módulo. Cada usuário tem uma configuração de acessos para cada módulo. Os acessos são opcionais e podem ser definidos por default.
- **list**: descreve uma lista de visualização do módulo, configurando filtros e colunas. Podem existir várias listas diversas por módulo. O metadata `list` é opcional para o servidor, mas obrigatório que exista pelo menos uma `list` por módulo para a interface padrão.
- **view**: descreve uma visualização e formulário do módulo onde um registro é editável ou visualizado com detalhes. Cada `list` define uma `view` para abrir a tela do registro. Esse metadata é opcional para o servidor, mas obrigatório que exista pelo menos uma `view` por módulo para a interface padrão.
- **pivot**: descreve um relatório em formato de tabela pivot para cada módulo, configurando filtros, colunas, linhas, valores e agregadores. Podem existir múltiplos `pivot` para cada módulo. O metadata `pivot` é opcional.

## Document

Um objeto `document` define a estrutura, os campos, as regras de validação, relacionamentos e configurações de um módulo de dados na plataforma. Ele serve como a especificação principal para como os dados desse módulo serão armazenados, exibidos e manipulados pelo sistema. Cada propriedade do objeto controla um aspecto fundamental do comportamento do módulo, permitindo flexibilidade e padronização na criação de novos módulos.

Abaixo estão as principais propriedades de um objeto `document`:

| Propriedade      | Tipo         | Descrição                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Identificador único do módulo/documento.                                                            |
| `fields`         | objeto       | Define os campos do módulo, incluindo tipo, validações, rótulos, relacionamentos e opções.          |
| `icon`           | string       | Ícone representativo do módulo, utilizado na interface.                                             |
| `label`          | objeto       | Rótulos do módulo em diferentes idiomas, para exibição amigável ao usuário.                         |
| `menuSorter`     | número       | Define a ordem de exibição do módulo nos menus da interface.                                        |
| `name`           | string       | Nome técnico do módulo/documento, utilizado internamente pelo sistema. Deve ser o mesmo que o `_id` |
| `plurals`        | objeto       | Pluralização do nome do módulo em diferentes idiomas, para uso em listas e títulos.                 |
| `saveHistory`    | boolean      | Indica se o histórico de alterações do módulo deve ser salvo.                                       |
| `type`           | string       | Tipo do metadata, neste caso sempre `"document"`.                                                   |
| `indexes`        | objeto       | Índices adicionais para o módulo, otimizando buscas e garantindo unicidade de combinações de campos.|
| `sendAlerts`     | boolean      | Indica se o sistema deve enviar alertas relacionados a este módulo.                                 |

Cada campo dentro de `fields` também possui suas próprias propriedades, como `type`, `label`, `isRequired`, `isSortable`, entre outras, que detalham o comportamento e as restrições de cada atributo do módulo. Essas definições permitem que o sistema valide, exiba e manipule os dados de forma consistente e flexível, conforme as necessidades de cada módulo. Os campos `_user`, `_createdAt`, `_createdBy`, `_updatedAt` e `_updatedBy` são padrões, devem estar em todos os documents e suas configurações não devem ser alteradas.


### Exemplo de `document`
```json
{
		"_id": "Activity",
		"fields": {
			"code": {
				"isUnique": true,
				"isSortable": true,
				"type": "autoNumber",
				"name": "code",
				"label": {
					"pt_BR": "Código",
					"en": "Code"
				},
				"isInherited": true
			},
			"contact": {
				"name": "contact",
				"label": {
					"en": "Contact",
					"pt_BR": "Contato"
				},
				"isSortable": true,
				"isList": true,
				"document": "Contact",
				"descriptionFields": ["code", "name.full"],
				"detailFields": ["email", "phone"],
				"type": "lookup",
				"isInherited": true
			},
			"description": {
				"type": "richText",
				"name": "description",
				"label": {
					"en": "Description",
					"pt_BR": "Descrição"
				},
				"isInherited": true
			},
			"endAt": {
				"type": "dateTime",
				"name": "endAt",
				"label": {
					"en": "End",
					"pt_BR": "Fim"
				},
				"isSortable": true,
				"isInherited": true
			},
			"priority": {
				"type": "picklist",
				"isSortable": true,
				"label": {
					"en": "Priority",
					"pt_BR": "Prioridade"
				},
				"options": {
					"high": {
						"pt_BR": "Alta",
						"en": "High",
						"sort": 1
					},
					"medium": {
						"en": "Medium",
						"pt_BR": "Média",
						"sort": 2
					},
					"low": {
						"en": "Low",
						"pt_BR": "Baixa",
						"sort": 3
					}
				},
				"renderAs": "without_scroll",
				"maxSelected": 1,
				"minSelected": 1,
				"name": "priority",
				"optionsSorter": "sort",
				"isInherited": true
			},
			"private": {
				"type": "boolean",
				"name": "private",
				"label": {
					"en": "Private",
					"pt_BR": "Privado"
				},
				"isSortable": true,
				"isInherited": true
			},
			"startAt": {
				"type": "dateTime",
				"name": "startAt",
				"label": {
					"en": "Start",
					"pt_BR": "Início"
				},
				"isSortable": true,
				"isInherited": true
			},
			"status": {
				"maxSelected": 1,
				"minSelected": 1,
				"name": "status",
				"optionsSorter": "sort",
				"isSortable": true,
				"label": {
					"en": "Status",
					"pt_BR": "Situação"
				},
				"options": {
					"new": {
						"en": "New",
						"pt_BR": "Nova",
						"sort": 1
					},
					"in-progress": {
						"en": "In Progress",
						"pt_BR": "Em Andamento",
						"sort": 2
					},
					"done": {
						"en": "Done",
						"pt_BR": "Concluída",
						"sort": 3
					},
					"canceled": {
						"en": "Canceled",
						"pt_BR": "Cancelada",
						"sort": 4
					}
				},
				"renderAs": "without_scroll",
				"type": "picklist",
				"isInherited": true
			},
			"subject": {
				"type": "text",
				"name": "subject",
				"label": {
					"pt_BR": "Assunto",
					"en": "Subject"
				},
				"isRequired": true,
				"isSortable": true,
				"isInherited": true
			},
			"type": {
				"maxSelected": 1,
				"minSelected": 1,
				"name": "type",
				"optionsSorter": "asc",
				"isSortable": true,
				"label": {
					"en": "Type",
					"pt_BR": "Tipo"
				},
				"options": {
					"phone-call": {
						"en": "Phone Call",
						"pt_BR": "Ligação"
					},
					"demo": {
						"en": "Demo",
						"pt_BR": "Demonstração"
					},
					"email": {
						"en": "Email",
						"pt_BR": "Email"
					},
					"execution-control": {
						"en": "Execution Control",
						"pt_BR": "Controle de Execução"
					},
					"appointment": {
						"en": "Appointment",
						"pt_BR": "Agendamento"
					},
					"note": {
						"en": "Note",
						"pt_BR": "Anotação"
					},
					"delivery": {
						"en": "Delivery",
						"pt_BR": "Entrega"
					},
					"social-networks": {
						"en": "Social Networks",
						"pt_BR": "Redes Sociais"
					},
					"expression-of-gratitude": {
						"en": "Expression of Gratitude",
						"pt_BR": "Agradecimento"
					}
				},
				"renderAs": "without_scroll",
				"type": "picklist",
				"isInherited": true
			},
			"_createdAt": {
				"label": {
					"en": "Created At",
					"pt_BR": "Criado em"
				},
				"isSortable": true,
				"type": "dateTime",
				"name": "_createdAt",
				"isInherited": true
			},
			"_createdBy": {
				"type": "lookup",
				"name": "_createdBy",
				"label": {
					"en": "Created by",
					"pt_BR": "Criado por"
				},
				"isSortable": true,
				"document": "User",
				"descriptionFields": ["name", "group.name"],
				"isInherited": true
			},
			"_updatedAt": {
				"type": "dateTime",
				"name": "_updatedAt",
				"label": {
					"en": "Updated At",
					"pt_BR": "Atualizado em"
				},
				"isSortable": true,
				"isInherited": true
			},
			"_updatedBy": {
				"type": "lookup",
				"name": "_updatedBy",
				"label": {
					"en": "Updated by",
					"pt_BR": "Atualizado por"
				},
				"document": "User",
				"descriptionFields": ["name", "group.name"],
				"isInherited": true
			},
			"_user": {
				"isList": true,
				"document": "User",
				"descriptionFields": ["name", "group.name", "active"],
				"detailFields": ["phone", "emails"],
				"type": "lookup",
				"name": "_user",
				"label": {
					"en": "User",
					"pt_BR": "Usuário"
				},
				"isSortable": true,
				"isInherited": true
			},
		},
		"icon": "check",
		"label": {
			"en": "Activity",
			"pt_BR": "Atividade"
		},
		"menuSorter": 1,
		"name": "Activity",
		"plurals": {
			"pt_BR": "Atividades",
			"en": "Activities"
		},
		"saveHistory": true,
		"type": "document",
		"indexes": {
			"activity_more_unique": {
				"keys": {
					"contact:_id": 1,
					"campaign:_id": 1,
					"product:_id": 1,
					"status": 1
				},
				"options": {
					"unique": true,
					"name": "activity_more_unique"
				}
			}
		},
		"sendAlerts": true
	},
```

## List

O objeto `list` define como os registros de um módulo são apresentados em listas na interface do sistema. Ele especifica colunas, filtros, ordenações, opções de visualização, paginação e outros aspectos que controlam a experiência do usuário ao visualizar múltiplos registros de um módulo. Cada propriedade do objeto permite customizar a exibição, filtragem e interação com os dados listados.

| Propriedade      | Tipo         | Descrição                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Identificador único da lista, geralmente no formato `<Módulo>:list:<Nome>`.                        |
| `document`       | string       | Nome do módulo/documento ao qual a lista pertence.                                                  |
| `type`           | string       | Tipo do metadata, neste caso sempre `"list"`.                                                      |
| `name`           | string       | Nome da lista, utilizado para referência interna e exibição.                                        |
| `label`          | objeto       | Rótulos da lista em diferentes idiomas, para exibição amigável ao usuário.                          |
| `plurals`        | objeto       | Pluralização do nome da lista em diferentes idiomas.                                                |
| `columns`        | objeto       | Define as colunas exibidas na lista, suas propriedades e ordem.                                     |
| `filter`         | objeto       | Configuração dos filtros disponíveis para busca e segmentação dos registros.                        |
| `sorters`        | array        | Ordenações padrão aplicadas à lista.                                                                |
| `rowsPerPage`    | objeto       | Opções e valor padrão de quantidade de registros por página.                                        |
| `refreshRate`    | objeto       | Opções e valor padrão de atualização automática da lista.                                           |
| `view`           | string       | Nome da view associada à lista, utilizada para exibição detalhada dos registros.                    |
| `loadDataAtOpen` | boolean      | Indica se os dados devem ser carregados automaticamente ao abrir a lista.                           |
| `calendars`      | array        | (Opcional) Configurações de visualização em formato de calendário, se aplicável.                    |

Cada coluna definida em `columns` pode conter propriedades como `name`, `linkField`, `visible`, `minWidth`, `sort`, entre outras, que determinam como cada campo será exibido na lista. Os filtros em `filter` permitem ao usuário segmentar e buscar registros de acordo com critérios definidos.

### Exemplo de `list`
```json
{
		"_id": "Activity:list:Default",
		"calendars": [
			{
				"name": "Agenda",
				"startAt": "startAt",
				"help": {},
				"visible": true,
				"endAt": "endAt",
				"descriminator": "type",
				"title": "subject",
				"label": {},
				"description": {}
			}
		],
		"columns": {
			"code": {
				"name": "code",
				"linkField": "code",
				"visible": true,
				"minWidth": 60,
				"sort": 0
			},
			"type": {
				"linkField": "type",
				"visible": true,
				"minWidth": 100,
				"name": "type",
				"sort": 1
			},
			"startAt": {
				"name": "startAt",
				"linkField": "startAt",
				"visible": true,
				"minWidth": 150,
				"sort": 2
			},
			"endAt": {
				"name": "endAt",
				"linkField": "endAt",
				"visible": false,
				"minWidth": 150,
				"sort": 3
			},
			"subject": {
				"name": "subject",
				"linkField": "subject",
				"visible": true,
				"minWidth": 250,
				"sort": 4
			},
			"description": {
				"name": "description",
				"linkField": "description",
				"minWidth": 250,
				"sort": 5,
				"visible": true
			},
			"priority": {
				"name": "priority",
				"linkField": "priority",
				"visible": true,
				"minWidth": 100,
				"sort": 6
			},
			"status": {
				"name": "status",
				"linkField": "status",
				"visible": true,
				"minWidth": 100,
				"sort": 7
			},
			"contact": {
				"minWidth": 180,
				"name": "contact",
				"linkField": "contact",
				"visible": true,
				"sort": 8
			},
			"private": {
				"name": "private",
				"linkField": "private",
				"minWidth": 50,
				"sort": 9
			},
			"_user": {
				"minWidth": 160,
				"name": "_user",
				"linkField": "_user",
				"visible": true,
				"sort": 10
			},
			"_createdAt": {
				"name": "_createdAt",
				"linkField": "_createdAt",
				"minWidth": 160,
				"sort": 11,
				"visible": true
			},
			"_createdBy": {
				"minWidth": 160,
				"name": "_createdBy",
				"linkField": "_createdBy",
				"sort": 12,
				"visible": true
			},
			"_updatedAt": {
				"name": "_updatedAt",
				"linkField": "_updatedAt",
				"style": {
					"colorBasedOnTime": "0:green:white,15:yellow,30:red:white,45:gray:white,60:black:white"
				},
				"minWidth": 160,
				"sort": 13,
				"visible": true
			},
			"_updatedBy": {
				"name": "_updatedBy",
				"linkField": "_updatedBy",
				"minWidth": 160,
				"sort": 14,
				"visible": true
			}
		},
		"document": "Activity",
		"filter": {
			"match": "and",
			"conditions": {
				"code:equals": {
					"operator": "equals",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "numberfield"
					},
					"term": "code",
					"sort": 0
				},
				"subject:contains": {
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "textfield"
					},
					"term": "subject",
					"operator": "contains",
					"sort": 4
				},
				"status:in": {
					"term": "status",
					"value": ["Nova", "Em Andamento"],
					"operator": "in",
					"editable": true,
					"style": {
						"columns": 1,
						"renderAs": "checkbox"
					},
					"sort": 5
				},
				"type:in": {
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "checkbox",
						"columns": 2
					},
					"term": "type",
					"operator": "in",
					"sort": 6
				},
				"priority:in": {
					"term": "priority",
					"operator": "in",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "checkbox",
						"columns": 3
					},
					"sort": 7
				},
				"contact:_id:equals": {
					"term": "contact._id",
					"operator": "equals",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "lookupfield",
						"removable": true,
						"hideOnDisable": true
					},
					"sort": 8
				},
				"_user:_id:equals": {
					"style": {
						"renderAs": "lookupfield",
						"hideOnDisable": true
					},
					"term": "_user._id",
					"operator": "equals",
					"editable": true,
					"disabled": true,
					"sort": 13
				},
				"_createdAt:between": {
					"value": {},
					"operator": "between",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "datetimefield",
						"hideOnDisable": true
					},
					"term": "_createdAt",
					"sort": 16
				},
				"_updatedAt:between": {
					"disabled": true,
					"style": {
						"renderAs": "datetimefield",
						"hideOnDisable": true
					},
					"term": "_updatedAt",
					"value": {},
					"operator": "between",
					"editable": true,
					"sort": 17
				}
			},
			"minFilledConditions": 0
		},
		"label": {
			"pt_BR": "Atividade",
			"en": "Activity"
		},
		"loadDataAtOpen": true,
		"name": "Default",

		"plurals": {
			"en": "Activities",
			"pt_BR": "Atividades"
		},
		"refreshRate": {
			"options": [
				0,
				5,
				10,
				15,
				30,
				60,
				300,
				600,
				900,
				1800,
				3600
			],
			"default": 0
		},
		"rowsPerPage": {
			"options": [
				5,
				10,
				15,
				20,
				25,
				50,
				100,
				200
			],
			"default": 25
		},
		"sorters": [
			{
				"term": "code",
				"direction": "desc"
			}
		],
		"type": "list",
		"view": "Default"
	},
```

## View

O objeto `view` define a estrutura e a organização visual dos formulários e telas de detalhamento de um módulo. Ele especifica como os campos e grupos de campos são apresentados ao usuário, permitindo customizar a experiência de visualização e edição dos registros. Cada propriedade do objeto controla aspectos como agrupamento, ordem, rótulos, estilos e tipos de componentes exibidos.

| Propriedade      | Tipo         | Descrição                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Identificador único da view, geralmente no formato `<Módulo>:view:<Nome>`.                         |
| `document`       | string       | Nome do módulo/documento ao qual a view pertence.                                                   |
| `type`           | string       | Tipo do metadata, neste caso sempre `"view"`.                                                      |
| `name`           | string       | Nome da view, utilizado para referência interna e exibição.                                         |
| `label`          | objeto       | Rótulos da view em diferentes idiomas, para exibição amigável ao usuário.                           |
| `plurals`        | objeto       | Pluralização do nome da view em diferentes idiomas.                                                 |
| `visuals`        | array        | Estrutura hierárquica de grupos, campos e componentes visuais exibidos na tela.                     |

Cada item em `visuals` pode ser um grupo (`visualGroup`), um campo (`visualSymlink`) ou outros tipos de componentes visuais, permitindo flexibilidade na organização e apresentação dos dados. Os estilos e propriedades adicionais controlam detalhes como ícones, títulos, renderização e comportamento dos campos.

O tipo `reverseLookup` dentro de `visuals` permite exibir uma lista de registros de outro módulo que possuem o registro atual como valor em um campo do tipo lookup, facilitando a visualização de relacionamentos inversos entre módulos.

### Exemplo de `view`
```json
{
		"_id": "Activity:view:Default",
		"document": "Activity",
		"label": {
			"en": "{code}: {type} - {subject}",
			"pt_BR": "{code}: {type} - {subject}"
		},
		"name": "Default",
		"plurals": {
			"en": "New Activity",
			"pt_BR": "Nova Atividade"
		},
		"type": "view",
		"visuals": [
			{
				"type": "visualGroup",
				"style": {},
				"label": {
					"en": "Formulário",
					"pt_BR": "Formulário"
				},
				"visuals": [
					{
						"type": "visualGroup",
						"style": {
							"icon": "info-sign",
							"title": {
								"pt_BR": "Informações",
								"en": "Information"
							}
						},
						"label": {
							"en": "Information",
							"pt_BR": "Informações"
						},
						"visuals": [
							{
								"type": "visualSymlink",
								"style": {
									"readOnlyVersion": true
								},
								"fieldName": "code"
							},
							{
								"type": "visualSymlink",
								"style": {
									"renderAs": "with_scroll"
								},
								"fieldName": "type"
							},
							{
								"fieldName": "priority",
								"defaultValue": "Média",
								"type": "visualSymlink",
								"style": {
									"renderAs": "with_scroll"
								}
							},
							{
								"type": "visualSymlink",
								"style": {
									"renderAs": "with_scroll"
								},
								"fieldName": "status",
								"defaultValue": "new"
							},
							{
								"type": "visualSymlink",
								"fieldName": "reason"
							},
							{
								"type": "visualSymlink",
								"fieldName": "subject"
							}
						]
					},
					{
						"type": "visualGroup",
						"style": {
							"icon": "zoom-in",
							"title": {
								"pt_BR": "Detalhes",
								"en": "Details"
							}
						},
						"label": {
							"en": "Details",
							"pt_BR": "Detalhes"
						},
						"visuals": [
							{
								"type": "visualSymlink",
								"style": {
									"linkedFormName": "Default"
								},
								"fieldName": "contact"
							},
							{
								"type": "visualSymlink",
								"fieldName": "private"
							},
							{
								"type": "visualSymlink",
								"style": {
									"height": 250
								},
								"fieldName": "description"
							},
							{
								"type": "visualSymlink",
								"fieldName": "startAt"
							},
							{
								"type": "visualSymlink",
								"fieldName": "endAt"
							}
						]
					}
				]
			},
      {
				"type": "reverseLookup",
				"style": {
					"title": {
						"en": "Messages",
						"pt_BR": "Mensagens"
					}
				},
				"field": "activity",
				"document": "Message",
				"list": "Default"
			}
		]
	}
```


## Pivot

### Descrição Geral

O objeto `pivot` define relatórios dinâmicos em formato de tabela dinâmica (pivot table) para um módulo. Ele permite configurar colunas, linhas, valores agregados, filtros e ordenações, possibilitando a análise flexível dos dados do módulo sob diferentes perspectivas. Cada propriedade do objeto controla um aspecto da geração e exibição do relatório, tornando possível criar dashboards e visões analíticas customizadas.

| Propriedade      | Tipo         | Descrição                                                                                           |
|------------------|--------------|-----------------------------------------------------------------------------------------------------|
| `_id`            | string       | Identificador único do pivot, geralmente no formato `<Módulo>:pivot:<Nome>`.                       |
| `document`       | string       | Nome do módulo/documento ao qual o pivot pertence.                                                  |
| `type`           | string       | Tipo do metadata, neste caso sempre `"pivot"`.                                                     |
| `name`           | string       | Nome do pivot, utilizado para referência interna e exibição.                                        |
| `label`          | objeto       | Rótulos do pivot em diferentes idiomas, para exibição amigável ao usuário.                          |
| `plurals`        | objeto       | Pluralização do nome do pivot em diferentes idiomas.                                                |
| `columns`        | objeto       | Define as colunas da tabela dinâmica, geralmente associadas a campos do módulo.                     |
| `rows`           | array        | Define as linhas da tabela dinâmica, geralmente associadas a campos do módulo.                      |
| `values`         | array        | Configura os valores agregados (ex: soma, contagem) exibidos na tabela dinâmica.                    |
| `filter`         | objeto       | Configuração dos filtros disponíveis para segmentação dos dados analisados.                         |
| `sorters`        | array        | Ordenações padrão aplicadas ao relatório.                                                           |
| `rowsPerPage`    | objeto       | Opções e valor padrão de quantidade de registros por página.                                        |
| `refreshRate`    | objeto       | Opções e valor padrão de atualização automática do relatório.                                       |
| `loadDataAtOpen` | boolean      | Indica se os dados devem ser carregados automaticamente ao abrir o relatório.                       |

Cada item em `columns`, `rows` e `values` pode conter propriedades como `name`, `linkField`, `label`, `aggregator`, entre outras, que determinam como os dados serão agrupados e agregados na tabela dinâmica. Os filtros em `filter` permitem ao usuário segmentar os dados analisados conforme critérios definidos.

### Exemplo de `pivot`
```json
{
		"_id": "Activity:pivot:Default",
    "type": "pivot",
		"document": "Activity",
    "label": {
			"en": "Report",
			"pt_BR": "Relatório"
		},
		"name": "Default",
		"plurals": {
      "en": "Report",
			"pt_BR": "Relatório"
		},
    "loadDataAtOpen": true,
		"filter": {
			"match": "and",
			"conditions": {
				"status:in": {
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "checkbox",
						"columns": 1
					},
					"term": "status",
					"value": ["Nova", "Em Andamento"],
					"operator": "in",
					"sort": 0
				},
				"type:in": {
					"style": {
						"renderAs": "checkbox",
						"columns": 2,
						"hideOnDisable": true
					},
					"term": "type",
					"operator": "in",
					"editable": true,
					"disabled": true,
					"sort": 1
				},
				"priority:in": {
					"term": "priority",
					"operator": "in",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "checkbox",
						"columns": 3,
						"hideOnDisable": true
					},
					"sort": 2
				},
				"contact:_id:equals": {
					"term": "contact._id",
					"operator": "equals",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "lookupfield",
						"removable": true,
						"hideOnDisable": true
					},
					"sort": 4
				},
				"_user:_id:equals": {
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "lookupfield",
						"hideOnDisable": true
					},
					"term": "_user._id",
					"operator": "equals",
					"sort": 5
				},
				"_createdAt:between": {
					"term": "_createdAt",
					"value": {},
					"operator": "between",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "datetimefield",
						"hideOnDisable": true
					},
					"sort": 6
				},
				"_updatedAt:between": {
					"term": "_updatedAt",
					"value": {},
					"operator": "between",
					"editable": true,
					"disabled": true,
					"style": {
						"renderAs": "datetimefield",
						"hideOnDisable": true
					},
					"sort": 7
				}
			},
			"minFilledConditions": 0
		},
    "columns": {
			"status": {
				"name": "status",
				"linkField": "status",
				"visible": true,
				"minWidth": 150,
				"label": {
					"en": "Status",
					"pt_BR": "Situação"
				},
				"isInherited": true
			}
		},
		"rows": [
			{
				"name": "_user.group",
				"linkField": "_user.group",
				"visible": true,
				"label": {
					"en": "User",
					"pt_BR": "Usuário"
				}
			},
			{
				"name": "_user",
				"linkField": "_user",
				"visible": true,
				"label": {
					"en": "User",
					"pt_BR": "Usuário"
				}
			}
		],
    "values": [
			{
				"linkField": "code",
				"visible": true,
				"minWidth": 50,
				"label": {
					"en": "Code",
					"pt_BR": "Código"
				},
				"aggregator": "count",
				"name": "code"
			}
		],
		"sorters": [
			{
				"term": "status",
				"direction": "asc"
			}
		],
		"refreshRate": {
			"options": [0],
			"default": 0
		},
		"rowsPerPage": {
			"options": [100, 1000, 10000, 100000],
			"default": 1000
		}
	},
```

## Access, papéis e grupos

[Descrito em detalhes em ./access.md](./access.md)

## Hooks

[Descrito em detalhes em ./hooks.md](./hooks.md)

