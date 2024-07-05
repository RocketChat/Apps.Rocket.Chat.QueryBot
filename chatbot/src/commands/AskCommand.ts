import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { LlmService } from "../services/LlmService";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nDescription = "Ask a question to the LLM";
    public i18nParamsExample = "Your question";
    public providesPreview = false;

    constructor(private readonly llmService: LlmService) {}

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

        const model = (await read
            .getEnvironmentReader()
            .getSettings()
            .getValueById("llm_endpoint")) as string;

        const embedding = await this.llmService.createEmbedding(query);

        const messageIds = await this.llmService.queryVectorDB(embedding);

        const messages = await Promise.all(
            messageIds.map((id) => this.llmService.getMessageById(id, read))
        );
        const contextText = messages.join(" ");

        const combinedQuery = `Context: ${contextText}\n\nQuestion: ${query}`;

        const response = await this.llmService.queryLLM(
            model,
            combinedQuery,
            userId
        );

        const builder = modify
            .getCreator()
            .startMessage()
            .setRoom(room)
            .setText(response);

        await modify.getCreator().finish(builder);
    }
}
