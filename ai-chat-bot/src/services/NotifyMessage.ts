import { IRead } from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUser } from "@rocket.chat/apps-engine/definition/users";

export async function notifyMessage(
    room: IRoom,
    read: IRead,
    user: IUser,
    message: string,
    threadId?: string
): Promise<void> {
    const notifier = read.getNotifier();
    const messageBuilder = notifier.getMessageBuilder();

    messageBuilder.setText(message);
    messageBuilder.setRoom(room);
    messageBuilder.setUsernameAlias("Chat Assistant");
    messageBuilder.setAvatarUrl(
        "https://cdn-icons-png.flaticon.com/512/8943/8943377.png"
    );

    if (threadId) {
        messageBuilder.setThreadId(threadId);
    }

    return notifier.notifyUser(user, messageBuilder.getMessage());
}
