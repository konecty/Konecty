# Konecty Access

No Konecty, as permissões de acesso a módulos e dados podem ser manipuladas das seguintes formas:

- User Access
- Module Access
- Groups and User filters

## User Access

O campo access do usuário descreve quais módulos estarão aparentes no menu do usuário.

O campo access é normalmente herdado do Role para o User.

Exemplo de access em um Role:

```json
{
  "name": "Client",        // nome do Role
  "access": {              // campo que vai ser herdado no usuário
    "defaults": [          // nome do Access usado para permissões nos módulos, qualquer módulo não listado abaixo, usa esse valor
      "Client"
    ],
    "Task": "Manager",      // nome do Access usado para o módulo específico
    "Contact": false,  
    "User": false          // false esconde o menu do usuário
  }
}
```

O processamento do acesso vai seguir a seguinte ordem:

1. Verificar se o módulo tem um access específico configurado, se tiver, é usado esse valor.

- 1a. Se o access específico for false, o módulo ficará escondido e nenhum outro processamento é feito
- 1b. É buscado um access para o módulo com esse nome (ex: {_id: Task:access:Manager, type: access, document: Task, name: Manager}, conforme descrito abaixo)
- 1c. É buscado um access default com esse nome (ex: {_id: Default:access:Manager, type: access, document: Default, name: Manager}, conforme descrito abaixo)
- 1d. Se nenhum access for encontrado, o módulo ficará escondido e sem permissões de leitura. Nenhum outro processamento é feito.

2. Se não houver um access específico listado, a lista defaults é percorrida e o primeiro access válido encontrado é usado tentando encontrar um access para o módulo ou um access default.

3. Se não encontrar nenhum access válido, o módulo ficará escondido e sem permissões de leitura.

\* Futuramente, um access com o isReadable: false esconderá o módulo do menu, mas permitirá outras operações (criar, atualizar, deletar) via API.


## Module Access

Cada módulo pode ter um ou mais objetos descrevendo tipos diferentes de acesso, que serão linkados as aos apontamentos citados acima.

É prática comum que os acessos tenham nomes dos Roles associados, mas não obrigatório.

```javascript
{
  // campos descritivos do metadata, _id deve ser formado por document:type:name
  "_id": "Task:access:Client",
  "document": "Task",
  "type": "access",
  "name": "Client",
  "label": {
    "en": "Client",
    "pt_BR": "Client"
  },

  // permissão de operações nos documentos desse módulo
  "isCreatable": true,      // pode/não pode criar novo
  "isReadable": true,       // pode/não pode ver
  "isUpdatable": true,      // pode/não pode atualizar
  "isDeletable": false,     // pode/não pode deletar 

  // permissão especial de leitura,
  // o documento deve atender este filtro especial para poder ser visto pelo usuário
  "readFilter": {
    "match": "or"
    "conditions": [
      {
        "term": "status",
        "operator": "equals",
        "value": "Ativo"
      }
    ]
  },
  "updateFilter": { },    // mesmo formato que o readFilter
  "deleteFilter": { },    // mesmo formato que o readFilter

  // permissão 'default' de operações nos campos desse módulo, geralmente sera modificado campo a campo mais a baixo
  "fieldDefaults": {
    "isCreatable": false,
    "isUpdatable": false,
    "isReadable": false,
    "isDeletable": false
  },

  // permissões de operações por campo
  // quando true, podem ter uma `condition` com uma instrução a mais para filtrar a permissão
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

  // permissões de exportação. Define exportação em html, pdf ou xls e pode permitir exportações de "view", "list" ou "pivot"
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

  // permissões de operações com User. Controla o widget de alteração de usuários na interface, mas não evita operações via API
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

### Acessos Default

Existe uma configuração de acesso default que será usada para módulos que não tem um acesso específico definido.

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

Dessa forma é possível definir um acesso de admin que tem acesso liberado para todos os módulos e campos.

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

Com o user ou role configurado para usar o acesso Full, todos os módulos e campos estarão liberados.
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

## Valores especiais

Existem alguns valores especiais que podem ser usados nos filtros de acesso que serão computados de acordo com o User e o momento do acesso: `$user`, `$group`, `$groups`, `$allgroups`, `$now`

```
conditions: [
  {
    "term": "_createdBy",
    "operator": "equals",
    "value": "$user"          // representa o mesmo usuário, como _id
  },
]
```

```
conditions: [
  {
    "term": "_user.group._id",
    "operator": "equals",
    "value": "$group          // representa o grupo usuário, conforme preenchido no campo "group", como _id
  },
]
```

```
conditions: [
  {
    "term": "_user.group._id",
    "operator": "in",
    "value": "$allgroups     // representa todos os grupos usuário, 
			     // acumulando os valores preenchido nos campos "group" e "groups", como _ids
  },
]
```

```
conditions: [
  {
    "term": "activatedAt",
    "operator": "between",
    "value": {
	"lesser_than": "$now"   // computa a data e hora atual da consulta
    }
  },
]
```


## Acessos específicos para lookups

Um campo lookup de um documento pode usar um access específico que sobrescreve o access do usuário para a busca do lookup.
Dessa forma, um usuário que normalmente não tem acesso aos dados daquele módulo pode ser capaz de selecionar os registros dentro do escopo daquele lookup.

```
{
    "access": "Estimators" // usa as configurações de acesso de _id User:access:Estimators
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