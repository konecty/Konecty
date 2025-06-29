# Documentação do SDK Konecty Javascript/Typescript
## Visão Geral
O SDK Konecty fornece um conjunto de ferramentas para interagir com a plataforma Konecty. Esta documentação guia você pelos conceitos e recursos principais do SDK.

Disponível em [https://www.npmjs.com/package/@konecty/sdk](https://www.npmjs.com/package/@konecty/sdk)

## Criação do Cliente
O Cliente é a maneira mais fácil de interagir com a API Konecty. Para começar, você precisa criar uma instância do Cliente:

```ts
import { KonectyClient } from '@konecty/sdk/Client';

const config = {
  endpoint: 'YOUR_API_ENDPOINT',
  accessKey: 'YOUR_API_ACCESS_KEY',
};

const konectyClient = new KonectyClient(config);
```

Substitua YOUR_API_ENDPOINT e YOUR_API_ACCESS_KEY pelas suas credenciais reais da API Konecty.

## Processo de Login
Você pode usar o SDK sem uma Chave de Acesso à API e pedir ao usuário para se autenticar via login. 
Isso é útil para preservar as permissões configuradas para esses usuários, permitindo que eles acessem apenas as informações disponíveis na interface principal do Konecty. 
Esse método também permite que um aplicativo execute apenas no cliente, sem a necessidade de um servidor além da instância Konecty com a qual está se conectando.

O SDK lida com as complexidades do processo de login para você:

```ts
const userResponse = await client.login('YOUR_USERNAME', 'YOUR_PASSWORD');

if (userResponse.success) {
  // Usuário está logado!
  console.log('Logado como:', userResponse.data.username);
} else {
  // Credenciais inválidas
  console.error('Falha no login!');
}
```

Este processo valida o usuário, adquire os tokens e cookies necessários, e prepara a configuração para chamadas posteriores à API.

## Métodos de interação com registros

O Cliente fornece vários métodos para interagir com seus dados Konecty:

- **find:** Recupera uma lista de registros com base em critérios dados.
```ts
const products = await client.find('Product', {
  filter: {
    conditions: [
      { term: 'name', operator: 'equals', value: 'Draft Product' }
    ]
  },
  fields: ['code', 'name', 'order', ...]
});

console.log(products)
// {
//   success: true,
//   data: [
//     { code: 1, name: 'Draft Product', order: 1, ... }
//     { code: 2, name: 'Draft Product', order: 2, ... }
//     { code: 3, name: 'Draft Product', order: 3, ... }
//   ]
// }
```

- **create:** Cria um novo registro..
```ts
const newProduct = await client.create('Product', {
  name: 'Draft Product',
  // ...outros dados do produto
});

console.log(newProduct)
// {
//   success: true,
//   data: [
//     { _id: 'unique-id', code: 100, name: 'Draft Product', _updatedAt: '2024-07-29T10:00:57.396Z', ...  }
//   ]
// }
```

- **update:** Atualiza registros existentes por IDs.
```ts
const product = await client.update('Product', {
    status: 'updated',
    // ...outros dados do produto
  },
  [
    { _id: 'unique-id', _updatedAt: { $date: '2024-07-29T10:00:57.396Z' }}
  ]
);

console.log(product)
// {
//   success: true,
//   data: [
//     { _id: 'unique-id', code: 100, name: 'Draft Product', status: 'updated', _updatedAt: '2024-07-29T10:01:57.396Z', ... }
//   ]
// }
```


## Exemplos de Uso

### Script Node.js
Crie um diretório com um package.json, configurações para typescript e um arquivo index.ts vazio:

```shell
mkdir my-konecty-script
cd my-konecty-script
yarn init -y
yarn add @konecty-sdk
yarn add typescript ts-node @types/node
npx tsc --init
touch index.ts
```

Copie o seguinte código para o seu index.ts

```ts
import { KonectyClient } from "@konecty/sdk/Client";
// Criação do cliente (substitua com suas credenciais)
const client = new KonectyClient({
  endpoint: 'YOUR_API_ENDPOINT',
  accessKey: 'YOUR_API_ACCESS_KEY',
});
// se estiver rodando o konecty em local host, verifique se está rodando em http://localhost:3000 ou http://0.0.0.0:3000

const main = async () => {
  try {
    // 1. Criar um produto rascunho
    const newProduct = (await client.create("Product", {
      name: "Draft Product",
      status: "draft",
    }));

    if (!newProduct.success || newProduct.data == null) {
      throw new Error(`Erro ao criar produto rascunho: ${newProduct.errors}`);
    }

    console.log(
      "Produto rascunho criado:",
      newProduct.data[0]._id,
      newProduct.data[0]._updatedAt
    );

    // 2. Encontrar o produto rascunho
    const draftProduct = (await client.find("Product", {
      filter: {
        conditions: [
          { term: "_id", operator: "equals", value: newProduct.data[0]._id },
        ],
      },
      fields: ["code", "name", "description", "status", "_updatedAt"],
    }));

    if (!draftProduct.success || draftProduct.data == null) {
      throw new Error(`Erro ao buscar produto rascunho: ${newProduct.errors}`);
    }

    console.log(
      "Produto criado:",
      draftProduct.data[0]
    );

    // 3. Atualizar o produto rascunho
    const productID = {
      _id: draftProduct.data[0]._id,
      _updatedAt: { $date: draftProduct.data[0]._updatedAt },
    };
    const updatedProduct = (await client.update(
      "Product",
      {
        status: 'active',
        description: "Esta é uma descrição atualizada do produto.",
      },
      [productID]
    ));

    if (!updatedProduct.success || updatedProduct.data == null) {
      throw new Error(
        `Erro ao atualizar produto rascunho: ${updatedProduct.errors}`
      );
    }

    console.log(
      "Produto atualizado:",
      updatedProduct.data[0]._id,
      updatedProduct.data[0]._updatedAt
    );

    // 4. Encontrar o produto atualizado novamente
    const savedProduct = (await client.find("Product", {
      filter: {
        conditions: [
          {
            term: "_id",
            operator: "equals",
            value: updatedProduct.data[0]._id,
          },
        ],
      },
      fields: ["code", "name", "description", "status", "_updatedAt"],
    }));

    if (!savedProduct.success || savedProduct.data == null) {
      throw new Error(
        `Erro ao criar produto rascunho: ${updatedProduct.errors}`
      );
    }
    console.log("Produto rascunho encontrado:", savedProduct.data[0]);

    console.log("Fim do programa! :)");

  } catch (error) {
    console.error("Ocorreu um erro:", error);
  }
};

main();
```

Altere a linha com o `endpoint: 'YOUR_API_ENDPOINT'` usando a url do Konecty.

Se estiver rodando o Konecty em localhost, verifique se está rodando em http://localhost:3000 ou http://0.0.0.0:3000

Altere a linha com o `accessKey: 'YOUR_API_ACCESS_KEY'` usando a Chave de acesso de um usuário.

Instruções para adquirir a chave estão no guia [Adquirir a chave de acesso](https://github.com/konecty/konecty-docs/blob/main/konecty-dev-guides/find_konecty_access_key.md)


Rode o script usando ts-node
```shell
npx ts-node index.ts
```


### Aplicativo React
Crie um aplicativo react

```shell
yarn create vite my-konecty-app --template react-ts
cd my-konecty-app
yarn add @konecty/sdk js-cookie
yarn add -D @types/js-cookie vite-plugin-node-polyfills
```

Isso instala o SDK Konecty no seu projeto React. 
Você pode então importá-lo e usá-lo em seus componentes.

Para que o login funcione usando no app client side, deve ser usado um polyfill no browser para o crypto
Para isso, adicione o plugin no vite.config.ts ou execute esse commando para sobrescrever o arquivo:

```shell
cat > vite.config.js <<EOL
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills()],
})
EOL
```


Substitua o conteúdo do arquivo App.tsx com o código a seguir:

```tsx
import { useState, useEffect, useCallback } from "react";
import { KonectyClient } from "@konecty/sdk/Client";
import Cookies from "js-cookie";
import { KonectyDocument } from "@konecty/sdk/Module";
import "./App.css";

type GenericProduct = KonectyDocument & {
  name: string;
  status: string;
  code: number;
};

const config = {
  endpoint: 'YOUR_API_ENDPOINT'
};

const client = new KonectyClient(config);

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  input: {
    padding: "8px",
    margin: "4px",
  },
  ul: {
    listStyleType: "none",
    padding: "0",
  },
  li: {
    border: "1px black solid",
    borderRadius: "6px",
    margin: "4px",
    padding: "8px",
  },
  logout: {
    margin: "12px",
  }
} as {[key:string]: React.CSSProperties};

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [products, setProducts] = useState<GenericProduct[]>([]);

  const fetchProducts = useCallback(async () => {
    const response = await client.find<GenericProduct>("Product", {
      filter: {
        conditions: [
          {
            term: "_createdAt",
            operator: "between",
            value: {
              greater_equals: new Date(new Date().getTime() - 1800 * 1000),
            },
          },
        ],
      },
    });
    if (response.success && response.data) {
      if (response.data.length === 0) {
        await createProducts();
        fetchProducts();
      } else {
        setProducts(response.data);
      }
    } else {
      alert("Failed to fetch products: " + response.errors);
    }
  }, []);

  async function createProducts() {
    for (let i = 0; i < 4; i++) {
      await client.create("Product", {
        name: `New Product ${i}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function login(username: string, password: string) {
    const response = await client.login(username, password);
    if (response.success && response.authId) {
      Cookies.set("_authTokenId", response.authId);
      console.log("Logged in", response.user);
      setLoggedIn(true);
      fetchProducts();
    } else {
      alert("Login Failed!");
    }
  }

  async function logout() {
    Cookies.remove("_authTokenId");
    setProducts([]);
    setLoggedIn(false);
  }

  useEffect(() => {
    console.log("Checking if logged in");
    const authToken = Cookies.get("_authTokenId");
    if (authToken != null) {
      console.log("Logged with token: ", authToken);
      setLoggedIn(true);
    }
  }, [setLoggedIn]);
  
  useEffect(() => {
    if(loggedIn && products.length === 0) {
      console.log("Will fetch products");
      fetchProducts();
    }
  }, [fetchProducts, loggedIn, products]);

  if (!loggedIn) {
    return <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const username = form.username.value;
            const password = form.password.value;
            login(username, password);
          }}
          style={styles.form}
        >
          <input type="text" name="username" placeholder="Username" required style={styles.input} />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            style={styles.input}
          />
          <button type="submit">Login</button>
    </form>
  }

  return (
    <div>
      {!products.length ? (
        <div>Carregando...</div>
      ) : (
        <ul style={styles.ul}>
          {products.map((product) => (
            <li key={product._id} style={styles.li}>
              {product.name}: código {product.code}, criado em:{" "}
              {product._createdAt?.toString()}
            </li>
          ))}
        </ul>
      )}
      <button type="submit" style={styles.logout} onClick={logout}>Logout</button>
    </div>
  );
}

export default App;

```

Altere a linha com o `endpoint: 'YOUR_API_ENDPOINT'` usando a url do Konecty.

Se estiver rodando o Konecty em localhost, verifique se está rodando em http://localhost:3000 ou http://0.0.0.0:3000

Rode o app

```
yarn dev
```