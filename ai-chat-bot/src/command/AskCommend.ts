import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
    IAppAccessors,
    ILogger,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IMessageRaw } from "@rocket.chat/apps-engine/definition/messages";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { initializeLlmService } from "../services/LlmService";
import { notifyMessage } from "../services/NotifyMessage";
import { AiChatBotApp } from "../../AiChatBotApp";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nDescription = "Ask a question to the LLM";
    public i18nParamsExample = "Your question";
    public providesPreview = false;
    private readonly llmService: any;

    constructor(accessors: IAppAccessors, private app: AiChatBotApp) {
        this.llmService = initializeLlmService(accessors);
    }

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const query = context.getArguments().join(" ");
        const room = context.getRoom();
        const user = context.getSender();
        const threadId = context.getThreadId();

        const llmService = await this.llmService;

        try {
            await llmService.createSchema(http, this.app.getLogger());
            await notifyMessage(
                room,
                read,
                user,
                `**Your Question: ${query}**`,
                threadId
            );

            await this.processRoomMessages(room, read, http, user, threadId);

            const questionEmbedding = await llmService.createEmbedding(
                query,
                room,
                read,
                user,
                threadId,
                http
            );

            const relevantMessages = await llmService.queryVectorDB(
                questionEmbedding,
                room,
                read,
                user,
                threadId,
                http,
                this.app.getLogger()
            );

            const contextFromDB = this.prepareContext(relevantMessages);

            let customStyle = await read
                .getEnvironmentReader()
                .getSettings()
                .getValueById("custom_prompt");

            const defaultStyle =
                "Please format the answer in markdown, including bullet points or numbered lists if applicable.";

            const style = customStyle || defaultStyle;

            const prompt = `
                You are an expert assistant. Here is the context:
                ${contextFromDB}
                
                Please answer the following question in a clear and thorough manner:
                
                Question: ${query}
                
                ${style}
            `;

            const response = await llmService.queryLLM(
                this.app,
                prompt,
                http,
                this.app.getLogger()
            );

            await notifyMessage(room, read, user, response, threadId);
        } catch (error) {
            this.app.getLogger().error("Error executing ask command");
            this.app.getLogger().error(error);
        }
    }

    private async processRoomMessages(
        room: IRoom,
        read: IRead,
        http: IHttp,
        user: IUser,
        threadId?: string
    ): Promise<void> {
        const messages: IMessageRaw[] = await read
            .getRoomReader()
            .getMessages(room.id, {
                limit: 100,
            });

        const llmService = await this.llmService;

        for (const message of messages) {
            if (message.text) {
                // Check if the message has already been stored
                const isStored = await llmService.isMessageStored(
                    message.id,
                    room,
                    http,
                    this.app.getLogger()
                );

                if (!isStored) {
                    // Create an embedding for each individual message
                    const embedding = await llmService.createEmbedding(
                        message.text,
                        room,
                        read,
                        user,
                        threadId || "",
                        http
                    );

                    // Store the message text and its embedding in the vector database
                    await llmService.storeChatBotDoc(
                        message.text,
                        message.id,
                        embedding,
                        room,
                        read,
                        user,
                        threadId || "",
                        http,
                        this.app.getLogger()
                    );

                    this.app
                        .getLogger()
                        .debug(
                            `Stored message: "${message.text}" with embedding length: ${embedding.length}`
                        );
                } else {
                    this.app
                        .getLogger()
                        .debug(
                            `Message: "${message.text}" already stored, skipping.`
                        );
                }
            }
        }
    }

    private prepareContext(messages: string[]): string {
        return messages.slice(0, 5).join("\n\n");
    }
}
