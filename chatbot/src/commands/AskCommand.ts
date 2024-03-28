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
import { RagService } from "../services/RagService";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nParamsExample = "ask_params";
    public i18nDescription = "Ask a question";
    public providesPreview = false;

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const args = context.getArguments();

        const question = args.join(" ");

        if (!question) {
            throw new Error("Please provide a question.");
        }

        const ragService = new RagService(read, modify, http, persis);
        await ragService.handleQuery(context, question);
    }
}
