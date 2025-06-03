export function setupUiCommand(program: any) {
    const uiCommand = program.command("ui");

    uiCommand
        .command("up")
        .description("Start the local PlanqTN UI")
        .action(async () => {
            console.log("Starting the local PlanqTN UI");
        });

    uiCommand
        .command("stop")
        .description("Stop the local PlanqTN UI")
        .action(async () => {
            console.log("Stopping the local PlanqTN UI");
        });
}
