## PoolTogether LootBox Subgraph

The official PoolTogether LootBox subgraph.

#### Quick-use:

```sh
$ yarn clean && yarn prepare:local && graph codegen subgraph.local.yaml && graph build subgraph.local.yaml && yarn create:local && yarn deploy:local
```

#### Local Setup

First you'll need to setup a graph node, then you can deploy the project to it.

###### Local Graph Node

1. Clone the Graph Node repo:

```bash
$ git clone https://github.com/graphprotocol/graph-node/
```

2. Enter the dir

```bash
$ cd graph-node/docker
```

3. If using Linux, fix the local IP address:

```bash
$ ./setup.sh
```

4. Spin up the node

```bash
$ docker-compose up
```

###### Deploying the Subgraph Locally

Make sure you've already deployed the LootBox contracts.  If you haven't done so, check out https://github.com/pooltogether/loot-box.  Once the contracts are deployed locally on ganache-cli (remember to use 0.0.0.0 as the IP address for the RPC endpoint), you can set up the subgraph:

1. Install deps

```bash
$ yarn
```

2. Ensure generated code is up-to-date:

```bash
$ yarn codegen
```

3. Create a new local manifest called `subgraph.local.yaml`

```bash
$ cp subgraph.template.yaml subgraph.local.yaml
```

4. Update the corresponding addresses in `networks/local.json`


5. Allocate the subgraph in the local Graph node

```bash
$ yarn create-local
```

6. Update the local subgraph

```bash
$ yarn deploy-local
```

###### Deploying to Rinkeby

Deploy to staging:

```
$ yarn prepare:rinkeby && yarn gen:rinkeby && yarn build:rinkeby && yarn deploy:rinkeby-stg
```

# Tag a Release

To git tag a new release using the `version` in the `package.json` use the command:

```
$ yarn tag-release
```
