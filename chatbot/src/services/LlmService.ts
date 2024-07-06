import {
    IHttp,
    IRead,
    IAppAccessors,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { notifyMessage } from "./notifyMessage";
import { getEndpoint } from "./endpointsConfig";

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

export async function createEmbedding(
    text: string,
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp
): Promise<number[]> {
    try {
        const embeddingEndpoint =
            "http://text-embedding-api:8020/embed_multiple";
        const body = JSON.stringify([text]);
        const response = await http.post(embeddingEndpoint, {
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
            },
            content: body,
        });

        if (!response || !response.content) {
            await notifyMessage(
                room,
                read,
                user,
                "Failed to fetch embedding",
                threadId
            );
            throw new Error("Failed to fetch embedding");
        }

        const responseData = JSON.parse(response.content);
        if (!responseData.embeddings || !responseData.embeddings[0]) {
            throw new Error("Embedding response format is invalid");
        }

        return responseData.embeddings[0];
    } catch (error) {
        await notifyMessage(
            room,
            read,
            user,
            `Error: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function queryLLM(
    model: string,
    prompt: string,
    userId: string,
    room: IRoom,
    user: IUser,
    threadId: string,
    http: IHttp,
    read: IRead
): Promise<string> {
    try {
        const endpoint = getEndpoint(model);

        const body = {
            model,
            messages: [
                {
                    role: "user",
                    content: prompt,
                    user: userId,
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
            await notifyMessage(
                room,
                read,
                user,
                "Something is wrong with AI. Please try again later",
                threadId
            );
            throw new Error("Failed to fetch response from LLM");
        }

        const responseData = JSON.parse(response.content);
        if (
            !responseData.choices ||
            !responseData.choices[0] ||
            !responseData.choices[0].message
        ) {
            throw new Error("LLM response format is invalid");
        }

        return responseData.choices[0].message.content;
    } catch (error) {
        await notifyMessage(
            room,
            read,
            user,
            `Error: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function queryVectorDB(
    embedding: number[],
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp,
    vectorDbEndpoint: string
): Promise<string[]> {
    try {
        const url = "http://weaviate:8080/v1/graphql";
        const content = {
            query: `{
                Get {
                    RocketChatDocs(
                        nearVector: {
                            vector: ${JSON.stringify(embedding)},
                            distance: 0.6
                        }
                        limit: 5
                    ) {
                        content
                        page_title
                        url
                        _additional {
                            certainty
                            distance
                        }
                    }
                }
            }`,
        };

        const response = await http.post(url, {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(content),
        });

        if (!response || !response.content) {
            console.error("Vector DB Response:", response);
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
            !responseData.data.Get.RocketChatDocs
        ) {
            console.error("Invalid Vector DB Response Format:", responseData);
            throw new Error("Vector DB response format is invalid");
        }

        return responseData.data.Get.RocketChatDocs.map(
            (result: any) => result.content
        );
    } catch (error) {
        console.error("Error querying Vector DB:", error);
        await notifyMessage(
            room,
            read,
            user,
            `Error: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function getMessageById(
    read: IRead,
    messageId: string
): Promise<string> {
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
        async queryLLM(
            prompt: string,
            userId: string,
            room: IRoom,
            user: IUser,
            threadId: string,
            http: IHttp,
            read: IRead
        ): Promise<string> {
            return queryLLM(
                settings.model,
                prompt,
                userId,
                room,
                user,
                threadId,
                http,
                read
            );
        },
        async createEmbedding(
            text: string,
            room: IRoom,
            read: IRead,
            user: IUser,
            threadId: string,
            http: IHttp
        ): Promise<number[]> {
            return createEmbedding(text, room, read, user, threadId, http);
        },
        async queryVectorDB(
            embedding: number[],
            room: IRoom,
            read: IRead,
            user: IUser,
            threadId: string,
            http: IHttp
        ): Promise<string[]> {
            return queryVectorDB(
                embedding,
                room,
                read,
                user,
                threadId,
                http,
                settings.vectorDbEndpoint
            );
        },
        async getMessageById(read: IRead, messageId: string): Promise<string> {
            return getMessageById(read, messageId);
        },
    };
}
