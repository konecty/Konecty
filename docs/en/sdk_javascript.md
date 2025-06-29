# Konecty Javascript/Typescript SDK Documentation
## Overview
The Konecty SDK provides a set of tools to interact with the Konecty platform. This documentation guides you through the main concepts and features of the SDK.

Available at [https://www.npmjs.com/package/@konecty/sdk](https://www.npmjs.com/package/@konecty/sdk)

## Creating the Client
The Client is the easiest way to interact with the Konecty API. To get started, you need to create a Client instance:

```ts
import { KonectyClient } from '@konecty/sdk/Client';

const config = {
  endpoint: 'YOUR_API_ENDPOINT',
  accessKey: 'YOUR_API_ACCESS_KEY',
};

const konectyClient = new KonectyClient(config);
```

Replace YOUR_API_ENDPOINT and YOUR_API_ACCESS_KEY with your actual Konecty API credentials.

## Login Process
You can use the SDK without an API Access Key and ask the user to authenticate via login. 
This is useful to preserve the permissions configured for those users, allowing them to access only the information available in the main Konecty interface. 
This method also allows an application to run only on the client, without the need for a server besides the Konecty instance it connects to.

The SDK handles the complexities of the login process for you:

```ts
const userResponse = await client.login('YOUR_USERNAME', 'YOUR_PASSWORD');

if (userResponse.success) {
  // User is logged in!
  console.log('Logged in as:', userResponse.data.username);
} else {
  // Invalid credentials
  console.error('Login failed!');
}
```

This process validates the user, acquires the necessary tokens and cookies, and prepares the configuration for subsequent API calls.

## Methods for interacting with records

The Client provides several methods to interact with your Konecty data:

- **find:** Retrieves a list of records based on given criteria.
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

- **create:** Creates a new record.
```ts
const newProduct = await client.create('Product', {
  name: 'Draft Product',
  // ...other product data
});

console.log(newProduct)
// {
//   success: true,
//   data: [
//     { _id: 'unique-id', code: 100, name: 'Draft Product', _updatedAt: '2024-07-29T10:00:57.396Z', ...  }
//   ]
// }
```

- **update:** Updates existing records by IDs.
```ts
const product = await client.update('Product', {
    status: 'updated',
    // ...other product data
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


## Usage Examples

### Node.js Script
Create a directory with a package.json, typescript settings, and an empty index.ts file:

```shell
mkdir my-konecty-script
cd my-konecty-script
yarn init -y
yarn add @konecty-sdk
yarn add typescript ts-node @types/node
npx tsc --init
touch index.ts
```

Copy the following code to your index.ts

```ts
import { KonectyClient } from "@konecty/sdk/Client";
// Client creation (replace with your credentials)
const client = new KonectyClient({
  endpoint: 'YOUR_API_ENDPOINT',
  accessKey: 'YOUR_API_ACCESS_KEY',
});
// if running Konecty on localhost, check if it is running at http://localhost:3000 or http://0.0.0.0:3000

const main = async () => {
  try {
    // 1. Create a draft product
    const newProduct = (await client.create("Product", {
      name: "Draft Product",
      status: "draft",
    }));

    if (!newProduct.success || newProduct.data == null) {
      throw new Error(`Error creating draft product: ${newProduct.errors}`);
    }

    console.log(
      "Draft product created:",
      newProduct.data[0]._id,
      newProduct.data[0]._updatedAt
    );

    // 2. Find the draft product
    const draftProduct = (await client.find("Product", {
      filter: {
        conditions: [
          { term: "_id", operator: "equals", value: newProduct.data[0]._id },
        ],
      },
      fields: ["code", "name", "description", "status", "_updatedAt"],
    }));

    if (!draftProduct.success || draftProduct.data == null) {
      throw new Error(`Error finding draft product: ${newProduct.errors}`);
    }

    console.log(
      "Product created:",
      draftProduct.data[0]
    );

    // 3. Update the draft product
    const productID = {
      _id: draftProduct.data[0]._id,
      _updatedAt: { $date: draftProduct.data[0]._updatedAt },
    };
    const updatedProduct = (await client.update(
      "Product",
      {
        status: 'active',
        description: "This is an updated product description.",
      },
      [productID]
    ));

    if (!updatedProduct.success || updatedProduct.data == null) {
      throw new Error(
        `Error updating draft product: ${updatedProduct.errors}`
      );
    }

    console.log(
      "Product updated:",
      updatedProduct.data[0]._id,
      updatedProduct.data[0]._updatedAt
    );

    // 4. Find the updated product again
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
        `Error creating draft product: ${updatedProduct.errors}`
      );
    }
    console.log("Draft product found:", savedProduct.data[0]);

    console.log("End of program! :)");

  } catch (error) {
    console.error("An error occurred:", error);
  }
};

main();
```

Change the line with `endpoint: 'YOUR_API_ENDPOINT'` using your Konecty URL.

If running Konecty on localhost, check if it is running at http://localhost:3000 or http://0.0.0.0:3000

Change the line with `accessKey: 'YOUR_API_ACCESS_KEY'` using a user's access key.

Instructions to acquire the key are in the guide [Get the access key](https://github.com/konecty/konecty-docs/blob/main/konecty-dev-guides/find_konecty_access_key.md)

Run the script using ts-node
```shell
npx ts-node index.ts
```


### React Application
Create a react app

```shell
yarn create vite my-konecty-app --template react-ts
cd my-konecty-app
yarn add @konecty/sdk js-cookie
yarn add -D @types/js-cookie vite-plugin-node-polyfills
```

This installs the Konecty SDK in your React project. 
You can then import and use it in your components.

For login to work on the client-side app, you must use a crypto polyfill in the browser.
To do this, add the plugin in vite.config.ts or run this command to overwrite the file:

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

Replace the contents of App.tsx with the code below:

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
        <div>Loading...</div>
      ) : (
        <ul style={styles.ul}>
          {products.map((product) => (
            <li key={product._id} style={styles.li}>
              {product.name}: code {product.code}, created at: {" "}
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

Change the line with `endpoint: 'YOUR_API_ENDPOINT'` using your Konecty URL.

If running Konecty on localhost, check if it is running at http://localhost:3000 or http://0.0.0.0:3000

Run the app

```
yarn dev
``` 