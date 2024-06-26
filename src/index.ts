import { networks, findSupportedNetwork, NetworkConfig } from '@0xsequence/network'
import { ethers } from 'ethers'
import { Session, SessionSettings } from '@0xsequence/auth'
import { SequenceCollections } from '@0xsequence/metadata'

export interface Env {
    DEV: boolean;
    CLIENT_URL: string;
    CHAIN_HANDLE: string;
    PKEY: string;
    ADMIN: string;
    CONTRACT_ADDRESS: string;
    DAILY_MINT_RESTRICTION: number;
    SCENARIO_MODEL_ID: string;
    SCENARIO_API_KEY: string;
    ACCESS_KEY_ID: string;
    PROJECT_ID: number;
    COLLECTION_ID: string;
    PROJECT_ACCESS_KEY: string;
    PROJECT_ACCESS_KEY_DEV: string;
    PROJECT_ACCESS_KEY_PROD: string;
    JWT_ACCESS_KEY: string;
}

class StringUtils {
    static toSnakeCase = (str: any) => {
        return str.toLowerCase().replace(/\s+/g, '_');
    }
    
    static removeCharacter = (str: any, charToRemove: any)=>{
        return str.replace(new RegExp(charToRemove, 'g'), '');
    }

    static capitalizeFirstWord(str: any) {
        // Check if the string is not empty
        if (str.length === 0) return str;
        
        // Convert the first character to uppercase and concatenate the rest of the string
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    static formatStatString = (str: any, main = true) => {
        if(str == null ) return []
        const regex = /^(.*?)\s*([+-]?\d+)(-)?(\d+)?(%?)$/;
        const matches = str.match(regex);
        let formattedResult = [];
      
        if (matches) {
            let [_, stat_name, firstValue, rangeIndicator, secondValue, percentageSymbol] = matches;
            stat_name = StringUtils.removeCharacter(stat_name, ':')
            const baseDisplayType = StringUtils.toSnakeCase(stat_name);
            const isPercentage = percentageSymbol === '%';
      
            if (rangeIndicator === '-') {
                formattedResult.push({
                    "display_type": main ? baseDisplayType + "_min" : "sub_stats_"+baseDisplayType + "_min", 
                    "trait_type": stat_name + " Minimum", 
                    "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
                });
      
                formattedResult.push({
                    "display_type": main ? baseDisplayType + "_max" : "sub_stats_"+baseDisplayType + "_max", 
                    "trait_type": stat_name + " Maximum", 
                    "value": parseInt(secondValue, 10) + (isPercentage ? '%' : '')
                });
            } else {
                formattedResult.push({
                    "display_type": main ? baseDisplayType : "sub_stats_"+baseDisplayType, 
                    "trait_type": stat_name, 
                    "value": parseInt(firstValue, 10) + (isPercentage ? '%' : '')
                });
            }
        } 
      
        return formattedResult;
      }
};

const generate = async (): Promise<any> => {
    try {
        const url = 'https://flask-production-2641.up.railway.app/'; // External API endpoint
    
        const init = {
            method: 'GET',
            headers: {
            'Content-Type': 'application/json',
            },
        };

        const response = await fetch(url, init); // Fetch data from external API
        const data: any= await response.json(); 
        console.log(data)
            const attributes = []
            const defend = Math.random() >= 0.5 ? true : false

        // category
        attributes.push({
            display_type: "category",
            trait_type: "Category",
            value: data[defend ? 'armor' : 'weapon'].category
        })

        // main stats
        attributes.push(...StringUtils.formatStatString(data[defend ? 'armor' : 'weapon'].main_stats[0], true))

        // sub stats
        const sub_stats = data[defend ? 'armor' : 'weapon'].stats

        // tier
        sub_stats.map((stats: any) => {
            attributes.push(...StringUtils.formatStatString(stats, false))
        })

        // type
        attributes.push({
            display_type: "tier",
            trait_type: "tier",
            value: data[defend ? 'armor' : 'weapon'].tier
        })

        attributes.push({
            display_type: "type",
            trait_type: "type",
            value: data[defend ? 'armor' : 'weapon'].type
        })
        
        return {loot: data[defend ? 'armor' : 'weapon'], attributes: attributes}
    } catch(err: any) {
        console.log(err)
        throw new Error(err)
    }
}

const uploadAsset = async (env: Env, projectID: any, collectionID: any, assetID: any, tokenID: any, url: any) => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch file from ${url}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    const formData = new FormData();
    
    formData.append('file', blob, `image.png`); // You might want to dynamically determine the filename
    
    let METADATA_URL;

    if (env.DEV) {
        METADATA_URL = 'https://dev-metadata.sequence.app'
    } else {
        METADATA_URL = 'https://metadata.sequence.app'
    }

    // Construct the endpoint URL
    const endpointURL = `${METADATA_URL}/projects/${projectID}/collections/${collectionID}/tokens/${tokenID}/upload/${assetID}`;

    try {
        // Use fetch to make the request
        const fetchResponse = await fetch(endpointURL, {
            method: 'PUT',
            body: formData,
            headers: {
                'Authorization': `Bearer ${env.JWT_ACCESS_KEY}`, // Put your token here
            },
        });
    
        // Assuming the response is JSON
        const data = await fetchResponse.json();

        return data;
    } catch(err) {
        console.log('error uploading image')
        console.log(err)
    }
}

const upload = async (env: Env, name: any, attributes: any, imageUrl: any) => {
    let METADATA_URL;

    if (env.DEV) {
        METADATA_URL = 'https://dev-metadata.sequence.app'
    } else {
        METADATA_URL = 'https://metadata.sequence.app'
    }

    const collectionsService = new SequenceCollections(METADATA_URL, env.JWT_ACCESS_KEY)

    const collectionID = Number(env.COLLECTION_ID)
    const projectID = env.PROJECT_ID

    // tokenID
    const randomTokenIDSpace = ethers.BigNumber.from(ethers.utils.hexlify(ethers.utils.randomBytes(20)))

    try {
        const res1 = await collectionsService.createToken({
            projectId: projectID,
            collectionId: collectionID,
            token: {
                tokenId: String(randomTokenIDSpace),
                name: name,
                description: "A free AI treasure chest mini-game",
                decimals: 0,
                attributes: attributes
            }
        })

    } catch(err) {
        console.log('error creating token')
        console.log(err)
    }

    let res2;

    try {
        res2 = await collectionsService.createAsset({
            projectId: projectID,
            asset: {
                id: Number(String(randomTokenIDSpace).slice(0,10)),
                collectionId: collectionID,
                tokenId: String(randomTokenIDSpace),
                metadataField: "image"
            }
        })
    } catch(err) {
        console.log('error creating asset')
        console.log(err)
    }

    try {
        // upload asset
        const uploadAssetRes: any = await uploadAsset(env, projectID, collectionID, res2!.asset.id, String(randomTokenIDSpace), imageUrl)

        return {url: uploadAssetRes.url, tokenID: String(randomTokenIDSpace)}
    } catch(err) {
        console.log(err)
        throw new Error('Sequence Metadata Service Fail')
    }
}

const getInferenceWithItem = async (env: Env, prompt: any) => {
    try {
        const res: any = await fetch(`https://api.cloud.scenario.com/v1/models/${env.SCENARIO_MODEL_ID}/inferences`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${env.SCENARIO_API_KEY}`,
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                        "parameters": {
                        "numSamples": 1,
                        "qualityBoostScale": 4,
                        "qualityBoost": false,
                        "type": "txt2img",
                        "disableMerging": false,
                        "hideResults": false,
                        "referenceAdain": false,
                        "intermediateImages": false,
                        "scheduler": 'EulerDiscreteScheduler',
                        "referenceAttn": false,
                        "prompt": prompt + ' single object on black background no people'
                    }
                })
        })

        const data = await res.json()
        console.log(data)
        return {inferenceId: data.inference.id}
    }catch(err){
        console.log(err)
        return {inferenceId: null, err: "ERROR"}
    }
}

const getInferenceObjectWithPolling = async (env: Env, id: any) => {
    console.log('getting inference status for: ', id.inferenceId)
    const inferenceId = id.inferenceId

    const headers = {
        'Authorization': `Basic ${env.SCENARIO_API_KEY}`,
        'accept': 'application/json',
        'content-type': 'application/json'
    }

    // Function to poll the inference status
    const pollInferenceStatus = async () => {
        let status = '';
        let inferenceData: any = null;
        while (!['succeeded', 'failed'].includes(status)) {
            // Fetch the inference details
            try {
                const inferenceResponse = await fetch(`https://api.cloud.scenario.com/v1/models/${env.SCENARIO_MODEL_ID}/inferences/${inferenceId}`, {
                    method: 'GET',
                    headers
                })
                if (inferenceResponse.ok) {
                    console.log(inferenceResponse.statusText)
                    inferenceData = await inferenceResponse.json();
                }
            }catch(err){
                console.log(err)
            }
            status = inferenceData.inference.status;
            console.log(`Inference status: ${status}`);

            // Wait for a certain interval before polling again
            await new Promise(resolve => setTimeout(resolve, 5000)); // Polling every 5 seconds
        }
        // Handle the final status
        if (status === 'succeeded') {
            console.log('Inference succeeded!');
            console.log(inferenceData); // Print inference data
            return inferenceData
        } else {
            console.log('Inference failed!');
            console.log(inferenceData); // Print inference data
            throw new Error("Scenario API Failed")
        }
    };

    // Start polling the inference status
    return await pollInferenceStatus();
}

const callContract = async (env: Env, collectibleAddress: string, address: string, tokenID: number): Promise<ethers.providers.TransactionResponse> => {
    const chainConfig: NetworkConfig = findSupportedNetwork(env.CHAIN_HANDLE)!
    
    const provider = new ethers.providers.StaticJsonRpcProvider({
        url: chainConfig.rpcUrl, 
        skipFetchSetup: true // Required for ethers.js Cloudflare Worker support
    })

    const walletEOA = new ethers.Wallet(env.PKEY, provider);
    const relayerUrl = `https://${chainConfig.name}-relayer.sequence.app`

    // Open a Sequence session, this will find or create
    // a Sequence wallet controlled by your server EOA
    const settings: Partial<SessionSettings> = {
        networks: [{
            ...networks[chainConfig.chainId],
            rpcUrl: chainConfig.rpcUrl,
            provider: provider, // NOTE: must pass the provider here
            relayer: {
                url: relayerUrl,
                provider: {
                    url: chainConfig.rpcUrl
                }
            }
        }],
    }

    // Create a single signer sequence wallet session
    const session = await Session.singleSigner({
        settings: settings,
        signer: walletEOA,
        projectAccessKey: env.PROJECT_ACCESS_KEY_PROD
    })

    const signer = session.account.getSigner(chainConfig.chainId)
    
    // Standard interface for ERC1155 contract deployed via Sequence Builder
    const collectibleInterface = new ethers.utils.Interface([
        'function mint(address to, uint256 tokenId, uint256 amount, bytes data)'
    ])
        
    const data = collectibleInterface.encodeFunctionData(
        'mint', [`${address}`, `${tokenID}`, "1", "0x00"]
    )

    const txn = {
        to: collectibleAddress, 
        data: data
    }

    try {
        return await signer.sendTransaction(txn)
    } catch (err) {
        console.error(`ERROR: ${err}`)
        throw err
    }
}

// Works in both a Webapp (browser) or Node.js:
import { SequenceIndexer } from '@0xsequence/indexer'

const isLessThan24Hours = (isoDate: string) => {
    const dateProvided: any = new Date(isoDate);
    const currentDate: any = new Date();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Calculate the difference in milliseconds
    const difference = currentDate - dateProvided;

    // Check if the difference is less than 24 hours
    return difference < twentyFourHours && difference > 0;
}

const fullPaginationDay = async (env: Env, address: string) => {
    const txs: any = []
    const indexer = new SequenceIndexer(`https://${env.CHAIN_HANDLE}-indexer.sequence.app`, env.PROJECT_ACCESS_KEY)

    const filter = {
        accountAddress: address,
    };

    let txHistory: any
    let firstLoop = true;
    let finished = true;

    // if there are more transactions to log, proceed to paginate
    while(firstLoop || (!finished && txHistory.page.more)){  
        if(firstLoop){
            txHistory = await indexer.getTransactionHistory({
                filter: filter,
                page: { pageSize: 50 }
            })

            for(let i = 0; i < txHistory.transactions.length; i++){
                if(!isLessThan24Hours(txHistory.transactions[i].timestamp)){
                    finished = true
                }
                txs.push(txHistory.transactions[i])
            }
        }
        firstLoop = false
        txHistory = await indexer.getTransactionHistory({
            filter: filter,
            page: { 
                pageSize: 50, 
                // use the after cursor from the previous indexer call
                after: txHistory!.page!.after! 
            }
        })
        for(let i = 0; i < txHistory.transactions.length; i++){
            if(!isLessThan24Hours(txHistory.transactions[i].timestamp)){
                finished = true
            }
            txs.push(txHistory.transactions[i])
        }
    }

    return txs
}

const mintCount = (env: Env, txs: any) => {
    let count = 0
    for(let i = 0; i < txs.length; i++){
        if(
            txs[i].transfers[0].from == '0x0000000000000000000000000000000000000000' 
            && txs[i].transfers[0].contractAddress == env.CONTRACT_ADDRESS.toLowerCase()
        ) count++
    }
    return count
}

const hasDailyMintAllowance = async (env: Env, address: string) => {
    const txs = await fullPaginationDay(env, address)
    const count = mintCount(env, txs)
    return count < env.DAILY_MINT_RESTRICTION
}

async function handleRequest(request: any, env: Env, ctx: ExecutionContext) {
    const originUrl = new URL(request.url);
    const referer = request.headers.get('Referer');
    
    if (referer.toString() != env.CLIENT_URL) {
        return new Response('Bad Origin', { status: 500 }); // Handle errors
    }
    
    if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    // Allow requests from any origin - adjust this as necessary
                    "Access-Control-Allow-Origin": "*",
                    
                    // Allows the headers Content-Type, your-custom-header
                    "Access-Control-Allow-Headers": "Content-Type, your-custom-header",
                    
                    // Allow POST method - add any other methods you need to support
                    "Access-Control-Allow-Methods": "POST",
                    
                    // Optional: allow credentials
                    "Access-Control-Allow-Credentials": "true",
                    
                    // Preflight cache period
                    "Access-Control-Max-Age": "86400", // 24 hours
                }
            });
    }

    if (env.DEV) env.PROJECT_ACCESS_KEY = env.PROJECT_ACCESS_KEY_DEV
    else env.PROJECT_ACCESS_KEY = env.PROJECT_ACCESS_KEY_PROD

    const payload = await request.json()
    const { address, tokenID, mint }: any = payload

    // OPTIONAL
    // if(address.toLowerCase() != env.ADMIN.toLowerCase()){
    // 	if(!await hasDailyMintAllowance(env, address)){
    // 		return new Response(JSON.stringify({limitExceeded: true}), { status: 400 })
    // 	}
    // }

    if (mint) {
        try {
            const txn = await callContract(env, env.CONTRACT_ADDRESS, address, tokenID)
            return new Response(JSON.stringify({txnHash: txn.hash}), { status: 200 })
        } catch(error: any) {
            console.log(error)
            return new Response(JSON.stringify(error), { status: 400 })
        }
    }

    try {
        const loot = await generate()
        const id = await getInferenceWithItem(env, loot.loot.name)
        const inferenceObject = await getInferenceObjectWithPolling(env, id)
        const response = await upload(env, loot.loot.name + " " + loot.loot.type, loot.attributes, inferenceObject.inference.images[0].url)
        return new Response(JSON.stringify({loot: loot, image: response.url, name: loot.loot.name, tokenID: response.tokenID}), { status: 200 });
    } catch (error) {
        console.log(error)
        return new Response(JSON.stringify(error), { status: 500 }); // Handle errors
    }
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        // Process the request and create a response
        const response = await handleRequest(request, env, ctx);

        // Set CORS headers
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type");

        // return response
        return response;
    }
}
