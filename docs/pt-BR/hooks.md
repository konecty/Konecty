# Hooks

Hooks são funções que podem ser executadas antes, durante ou após um update ou create no Konecty.

Informações

- Cada hook é um script que roda num sandbox isolado de nodejs
- Todos scripts rodam num contexto isolado com acesso a variáveis globais, mas sem acesso a qualquer recurso externo além dos providos
- Todos hooks tem acesso implícito ao console javascript. Os logs de execução podem ser encontrados nos logs do Konecty
- A edição dos scripts é feita no repositório de metas do cliente
- Nenhum hook é obrigatório e não tem ligação um com o outro


A seguir seguem os hooks disponíveis:

## Before Validation
    - metadata: `scriptBeforeValidation`

**Quando roda**
O primeiro na linha dos scripts. Roda em qualquer mutação de dados (update e create)

**Para que serve**
Serve para modificar os dados antes de serem salvos (e prepará-los para validação) no banco

**Retorno**
Retorna um objeto que será mesclado com o registro a ser editado/criado

**Como usar**

O script é invocado como uma função recebendo os seguintes parâmetros:

| Parâmetro | Descrição |
|-----------|-----------|
| data | Contém o registro inteiro que está sendo modificado |
| emails | Array vazio para ser preenchido com emails a enviar |
| user | Contém o usuário que está fazendo a alteração |
| extraData | Objeto com as propriedades **original** (o registro original, sem alterações, objeto vazio na criação) e **request** (os dados enviados no update) |

```ts
const sandbox = createContext(contextData);
const scriptToRun = `result = (function(data, emails, user, console) { ${script} })(data, emails, user, console);`;
await runInContext(scriptToRun, sandbox);
```

Um exemplo de uso:

```ts
var ret = {};
var original = extraData.original;
var currentDate = new Date();
var record = data;

// Se o valor de status estava Ativo e foi alterado para Inativo, adiciona a data de desativação
if (data.status === 'Inativo'&& original.status == 'Ativo') {
    ret.deactivatedAt = currentDate;
}

// Se o valor de status foi altera Sucesso, apaga errorLogs
if (data.status !== original.status && data.status === 'Sucesso') {
    ret.errorLogs = null;
}

return ret;
```

## Validation
    - metadata: `validationScript` e `validationData`

**Quando roda**
O segundo hook a executar. Roda após todos os dados para a operação já terem sido computados

**Para que serve**
Serve para modificar os dados antes de serem salvos no banco

**Retorno**
Retorna um objeto que indica se a operação é valida além do motivo, caso não seja

**Como usar**

O script é invocado como uma função recebendo os seguintes parâmetros:

| Parâmetro | Descrição |
|-----------|-----------|
| data | Contém o registro inteiro que está sendo modificado, com os dados já processados |
| user | Contém o usuário que está fazendo a alteração |
| extraData | Objeto com as propriedades definidas no validationData. |
| **validationData** | Filtro definido no metadado para que o Konecty busque dados no banco e entregue ao script |

O validation data também é definido no metadata e deve ser um objeto no seguinte formato:

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

O validation data é usado para buscar dados no banco e entregá-los ao script.

Um exemplo de uso do script:

```ts
var original = ((extraData || {}).original || {})[0] || {};

// Se o usuário não é admin, não é permitido atualizar o status para "Ativo""
if ( user.role.name != 'Admin' && original.status !== 'Ativo' && data.status === 'Ativo') {
    return {
        "success": false,
        "reason": "Usuário não tem permissão para atualizar o status para Ativo"
    }
}

return {
    "success": true
}
```


## After Save
    - metadata: `scriptAfterSave`

**Quando roda**
Último hook a executar. Roda após os dados já terem sido salvos, logo antes de retornar ao usuário

**Para que serve**
Serve operações que necessitam de garantia que a operação foi concluída

**Retorno**
Não tem retorno

**Como usar**

O script é invocado como uma função recebendo os seguintes parâmetros:

| Parâmetro | Descrição |
|-----------|-----------|
| data | Array. Contém os registros inteiros já modificados |
| extraData | Contém o usuário que está fazendo a alteração |
| user | Objeto com as propriedades original (o registro original, sem alterações, undefined na criação) |
| Models | Objeto com todas collections do Konecty, indexadas pelo nome do metadado. Ex: Models[”Product”] |

```ts
const scriptAfterSave = async (data, extraData, user, Models) => {
    eval(scriptAfterSave);
}
```

Um exemplo de uso:

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

O hook `scriptAfterSave` tem acesso a um objeto chamado `request` que pode ser usado para fazer requisições HTTP.

O objeto request tem os seguintes métodos:

- `post({url, body, json, headers})`