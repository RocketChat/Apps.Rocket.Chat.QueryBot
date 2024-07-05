import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
    IAppAccessors,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { initializeLlmService } from "../services/LlmService";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nDescription = "Ask a question to the LLM";
    public i18nParamsExample = "Your question";
    public providesPreview = false;
    private readonly llmService: any;
    private readonly accessors: IAppAccessors;

    constructor(accessors: IAppAccessors) {
        this.accessors = accessors;
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
        const userId = context.getSender().id;
        const user = context.getSender();
        const threadId = context.getThreadId();

        const llmService = await this.llmService;
        const settings = llmService.settings;

        try {
            const embedding = await llmService.createEmbedding(
                query,
                room,
                read,
                user,
                threadId,
                http
            );

            const messageIds = await llmService.queryVectorDB(
                embedding,
                room,
                read,
                user,
                threadId,
                http,
                settings.vectorDbEndpoint
            );

            const messages = await Promise.all(
                messageIds.map((id: string) =>
                    llmService.getMessageById(read, id)
                )
            );
            const contextText = messages.join(" ");

            const combinedQuery = `Context: ${contextText}\n\nQuestion: ${query}`;

            const response = await llmService.queryLLM(
                settings.llmEndpoint,
                combinedQuery,
                userId,
                room,
                user,
                threadId,
                http,
                read
            );

            const builder = modify
                .getCreator()
                .startMessage()
                .setRoom(room)
                .setText(response);

            await modify.getCreator().finish(builder);
        } catch (error) {
            console.error(`Error executing ask command: ${error.message}`);
        }
    }
}
