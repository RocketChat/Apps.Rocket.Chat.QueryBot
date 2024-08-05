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
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { initializeLlmService } from "../services/LlmService";
import { notifyMessage } from "../services/notifyMessage";
import { type ChatBotApp } from "../../ChatBotApp";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nDescription = "Ask a question to the LLM";
    public i18nParamsExample = "Your question";
    public providesPreview = false;
    private readonly llmService: any;

    constructor(accessors: IAppAccessors, private app: ChatBotApp) {
        this.llmService = initializeLlmService(accessors);
    }

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        this.app.getLogger().debug("Executing AskCommand");
        const query = context.getArguments().join(" ");
        const room = context.getRoom();
        const userId = context.getSender().id;
        const user = context.getSender();
        const threadId = context.getThreadId();

        const llmService = await this.llmService;

        try {
            await llmService.createSchema(http, this.app.getLogger());
            await notifyMessage(
                room,
                read,
                user,
                "Processing your question...",
                threadId
            );

            const contextText = threadId
                ? await this.getThreadMessages(room, read, user, threadId)
                : "No thread ID provided";

            await notifyMessage(
                room,
                read,
                user,
                `Context Text: ${contextText}`,
                threadId
            );

            // Embed the context
            const contextEmbedding = await llmService.createEmbedding(
                contextText,
                room,
                read,
                user,
                threadId,
                http
            );

            // Store the context and its embedding
            this.app.getLogger().debug("Storing ChatBotDoc");
            await llmService.storeChatBotDoc(
                contextText,
                contextEmbedding,
                room,
                read,
                user,
                threadId,
                http,
                this.app.getLogger()
            );

            // Embed the question
            const questionEmbedding = await llmService.createEmbedding(
                query,
                room,
                read,
                user,
                threadId,
                http
            );

            // Query the vector database with the embedded question
            this.app
                .getLogger()
                .debug("Querying Vector DB with question embedding");
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

            await notifyMessage(
                room,
                read,
                user,
                `Context from DB: ${contextFromDB}`,
                threadId
            );

            const finalQuery = `Context: ${contextFromDB}\n\nQuestion: ${query}`;
            await notifyMessage(
                room,
                read,
                user,
                `Final Query: ${finalQuery}`,
                threadId
            );

            const response = await llmService.queryLLM(
                `Context Text: ${contextText}, Question: ${query}`,
                userId,
                room,
                user,
                threadId,
                http,
                read
            );

            const formattedResponse = this.formatResponse(response);

            await notifyMessage(room, read, user, formattedResponse, threadId);
        } catch (error) {
            this.app.getLogger().error("Error executing ask command");
            this.app.getLogger().error(error);
        }
    }

    private async getThreadMessages(
        room: IRoom,
        read: IRead,
        user: IUser,
        threadId: string
    ): Promise<string> {
        const threadReader = read.getThreadReader();
        const thread = await threadReader.getThreadById(threadId);

        if (!thread) {
            await notifyMessage(room, read, user, "Thread not found");
            throw new Error("Thread not found");
        }

        const messageTexts: string[] = [];
        for (const message of thread) {
            if (message.text) {
                messageTexts.push(`${message.sender.name}: ${message.text}`);
            }
        }

        return messageTexts.join("\n");
    }

    private prepareContext(messages: string[]): string {
        return messages.slice(0, 5).join("\n\n");
    }

    private formatResponse(response: string): string {
        return `Answer: ${response}`;
    }
}
