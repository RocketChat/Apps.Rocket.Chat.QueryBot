import {
    IHttp,
    IRead,
    IAppAccessors,
    ILogger,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { notifyMessage } from "./notifyMessage";
import { getEndpoint } from "./endpointsConfig";
import { App } from "@rocket.chat/apps-engine/definition/App";

export async function initializeSettings(
    accessors: IAppAccessors
): Promise<{ vectorDbEndpoint: string; model: string }> {
    const vectorDbEndpoint = (await accessors.environmentReader
        .getSettings()
        .getValueById("vector_db_endpoint")) as string;
    const model = (await accessors.environmentReader
        .getSettings()
        .getValueById("model")) as string;

    return { vectorDbEndpoint, model };
}

async function createEmbedding(
    text: string,
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp
): Promise<number[]> {
    try {
        const EMBEDDING_URL = "http://text-embedding-api:8020/embed_multiple";
        const headers = {
            accept: "application/json",
            "Content-Type": "application/json",
        };
        const data = JSON.stringify([text]);

        const response = await http.post(EMBEDDING_URL, {
            headers,
            content: data,
        });

        if (!response || !response.content) {
            await notifyMessage(
                room,
                read,
                user,
                `Failed to fetch embedding. Response: ${JSON.stringify(
                    response
                )}`,
                threadId
            );
            throw new Error("Failed to fetch embedding");
        }

        const responseData = JSON.parse(response.content);
        if (!responseData.embeddings || !responseData.embeddings[0]) {
            await notifyMessage(
                room,
                read,
                user,
                `Invalid Embedding Response Format: ${JSON.stringify(
                    responseData
                )}`,
                threadId
            );
            throw new Error("Embedding response format is invalid");
        }

        return responseData.embeddings[0];
    } catch (error) {
        await notifyMessage(
            room,
            read,
            user,
            `Error creating embedding: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function queryLLM(
    app: App,
    prompt: string,
    http: IHttp,
    logger: ILogger
): Promise<string> {
    try {
        const model = await app
            .getAccessors()
            .environmentReader.getSettings()
            .getValueById("model");
        const endpoint = getEndpoint(model);

        const body = {
            model,
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
            ],
        };

        const response = await http.post(endpoint + "/chat/completions", {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(body),
        });

        if (!response || !response.content) {
            logger.error(
                "Failed to fetch response from LLM. Response:",
                response
            );
            throw new Error("Failed to fetch response from LLM");
        }

        const responseData = JSON.parse(response.content);
        if (
            !responseData.choices ||
            !responseData.choices[0] ||
            !responseData.choices[0].message
        ) {
            logger.error(
                "LLM response format is invalid. Response data:",
                responseData
            );
            throw new Error("LLM response format is invalid");
        }

        return responseData.choices[0].message.content;
    } catch (error) {
        logger.error("Error querying LLM:", error);
        throw error;
    }
}

async function createSchema(http: IHttp, logger: ILogger): Promise<void> {
    try {
        const schemaResponse = await http.get("http://weaviate:8080/v1/schema");

        if (!schemaResponse || !schemaResponse.content) {
            throw new Error(
                "Failed to retrieve schema information from Weaviate"
            );
        }

        const schemaData = JSON.parse(schemaResponse.content);

        // if (
        //     schemaData &&
        //     schemaData.classes &&
        //     schemaData.classes.find((c: any) => c.class === "ChatBotDoc")
        // ) {
        //     logger.info("Schema already exists, skipping creation");
        //     return;
        // }

        const schema = {
            classes: [
                {
                    class: "ChatBotDoc",
                    properties: [
                        {
                            name: "content",
                            dataType: ["text"],
                        },
                        {
                            name: "messageId",
                            dataType: ["string"],
                        },
                        {
                            name: "roomId",
                            dataType: ["string"],
                        },
                    ],
                },
            ],
        };

        const response = await http.post("http://weaviate:8080/v1/schema", {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(schema),
        });

        if (!response || !response.content) {
            throw new Error("Failed to create schema in Weaviate");
        }
    } catch (error) {
        logger.error(`Error creating schema: ${error.message}`);
        throw error;
    }
}

async function isMessageStored(
    messageId: string,
    room: IRoom,
    http: IHttp,
    logger: ILogger
): Promise<boolean> {
    try {
        const content = {
            query: `{
                Get {
                    ChatBotDoc(
                        where: {
                            path: ["roomId"],
                            operator: Equal,
                            valueString: "${room.id}"
                        }
                        where: {
                            path: ["id"],
                            operator: Equal,
                            valueString: "${messageId}"
                        }
                        limit: 1
                    ) {
                        id
                    }
                }
            }`,
        };

        const response = await http.post("http://weaviate:8080/v1/graphql", {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(content),
        });

        if (!response || !response.content) {
            logger.error(
                "Failed to check message existence in vector DB. Response content is empty"
            );
            return false;
        }

        const responseData = JSON.parse(response.content);
        return (
            responseData.data &&
            responseData.data.Get &&
            responseData.data.Get.ChatBotDoc &&
            responseData.data.Get.ChatBotDoc.length > 0
        );
    } catch (error) {
        logger.error(`Error checking message in Vector DB: ${error.message}`);
        return false;
    }
}

async function queryVectorDB(
    embedding: number[],
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp,
    logger: ILogger
): Promise<string[]> {
    try {
        logger.info("Querying Vector DB with embedding", {
            embeddingLength: embedding.length,
        });

        const content = {
            query: `{
                Get {
                    ChatBotDoc(
                        nearVector: {
                            vector: ${JSON.stringify(embedding)},
                            distance: 0.6
                        },
                        where: {
                            path: ["roomId"],
                            operator: Equal,
                            valueString: "${room.id}"
                        },
                        limit: 3
                    ) {
                        content
                        _additional {
                            certainty
                            distance
                        }
                    }
                }
            }`,
        };

        const response = await http.post("http://weaviate:8080/v1/graphql", {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(content),
        });

        if (!response || !response.content) {
            logger.error(
                "Failed to fetch results from vector DB. Response content is empty"
            );
            await notifyMessage(
                room,
                read,
                user,
                "Failed to fetch results from vector DB",
                threadId
            );
            throw new Error("Failed to fetch results from vector DB");
        }

        const responseData = JSON.parse(response.content);
        if (
            !responseData.data ||
            !responseData.data.Get ||
            !responseData.data.Get.ChatBotDoc
        ) {
            logger.error("Invalid Vector DB Response Format", { responseData });
            await notifyMessage(
                room,
                read,
                user,
                `Invalid Vector DB Response Format: ${JSON.stringify(
                    responseData
                )}`,
                threadId
            );
            throw new Error("Vector DB response format is invalid");
        }

        return responseData.data.Get.ChatBotDoc.map(
            (result: any) => result.content
        );
    } catch (error) {
        logger.error(`Error querying Vector DB: ${error.message}`, {
            embedding,
        });
        await notifyMessage(
            room,
            read,
            user,
            `Error querying Vector DB: ${error.message}`,
            threadId
        );
        throw error;
    }
}

async function storeChatBotDoc(
    content: string,
    messageId: string,
    embedding: number[],
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp,
    logger: ILogger
): Promise<void> {
    try {
        logger.info("Attempting to store document in vector DB");

        const data = {
            class: "ChatBotDoc",
            properties: {
                content,
                messageId: messageId,
                roomId: room.id,
            },
            vector: embedding,
        };

        const response = await http.post("http://weaviate:8080/v1/objects", {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(data),
        });

        if (!response || !response.content) {
            logger.error(
                "Failed to store document in vector DB. Response content is empty"
            );
            await notifyMessage(
                room,
                read,
                user,
                "Failed to store document in vector DB",
                threadId
            );
            throw new Error("Failed to store document in vector DB");
        }
    } catch (error) {
        logger.error(`Error storing document in Vector DB: ${error.message}`, {
            contentSnippet: content.slice(0, 100),
            embeddingLength: embedding.length,
        });
        await notifyMessage(
            room,
            read,
            user,
            `Error storing document in Vector DB: ${error.message}`,
            threadId
        );
        throw error;
    }
}

async function getMessageById(read: IRead, messageId: string): Promise<string> {
    const message = await read.getMessageReader().getById(messageId);
    if (!message || !message.text) {
        throw new Error(`Failed to fetch message text with ID ${messageId}`);
    }
    return message.text;
}

export async function initializeLlmService(accessors: IAppAccessors) {
    const settings = await initializeSettings(accessors);

    return {
        settings,
        async createSchema(
            ...args: Parameters<typeof createSchema>
        ): Promise<void> {
            const logger = args[args.length - 1] as ILogger;
            logger.debug("Creating schema in Weaviate");
            return createSchema(...args);
        },
        async queryLLM(...args: Parameters<typeof queryLLM>): Promise<string> {
            return queryLLM(...args);
        },
        async createEmbedding(
            ...args: Parameters<typeof createEmbedding>
        ): Promise<number[]> {
            return createEmbedding(...args);
        },
        async queryVectorDB(
            ...args: Parameters<typeof queryVectorDB>
        ): Promise<string[]> {
            const logger = args[args.length - 1] as ILogger;
            logger.debug("Querying Vector DB with embedding");
            return queryVectorDB(...args);
        },
        async storeChatBotDoc(
            ...args: Parameters<typeof storeChatBotDoc>
        ): Promise<void> {
            const logger = args[args.length - 1] as ILogger;
            logger.debug("Storing ChatBotDoc with args:");
            return storeChatBotDoc(...args);
        },
        async isMessageStored(
            ...args: Parameters<typeof isMessageStored>
        ): Promise<boolean> {
            return isMessageStored(...args);
        },
        async getMessageById(
            ...args: Parameters<typeof getMessageById>
        ): Promise<string> {
            return getMessageById(...args);
        },
    };
}
