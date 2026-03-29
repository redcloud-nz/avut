/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { AVUTLogger } from "@/lib/logger";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import prisma from "./prisma";

/**
 * Defines a structured pipeline for processing form submissions, allowing for multiple stages of processing with built-in logging, error handling, and conditional execution of stages.
 * This pipeline can be used to implement complex form processing logic in a modular and maintainable way, with clear visibility into the execution of each stage through the use of the AVUTLogger.
 * @param FormData The shape of the form data being processed by this pipeline.
 * @param Context An optional custom context object that can be passed through each stage of the pipeline, allowing for shared state and dependencies to be accessed by each stage function.
 *
 * @example
 * ```ts
 * const myFormProcessingPipeline = FormProcessingPipeline.builder<MyFormDataType>("MyFormPipeline")
 *   .stage({
 *     stageName: "Validate Form Data",
 *     stageFn: async (ctx) => {
 *       // Perform validation logic on ctx.formData
 *       if (!isValid(ctx.formData)) {
 *         throw new Error("Form data is invalid");
 *       }
 *
 *      // Optionally return output that can be used in subsequent stages
 *      return { validatedData: ctx.formData as MyValidatedFormDataType };
 *     },
 *   })
 *   .conditionalStage({
 *     stageName: "Check Additional Conditions",
 *     test: (ctx) => ctx.formData.someField === "someValue",
 *     stageFn: async (ctx, { validatedData }) => {
 *       // Perform additional processing that only runs if the test condition is met
 *     },
 *   })
 *   .stage({
 *     stageName: "Save to Database",
 *     stageFn: async (ctx) => {
 *       await saveToDatabase(ctx.formData);
 *     },
 *  })
 *  .build();
 * ```
 */
export class FormProcessingPipeline<FormData, CustomContext extends object = {}> {
    readonly pipelineName: string;
    private options: FormPipelineOptions;
    private stages: Array<FormProcessingPipelineStage<FormData, CustomContext, any, any>>;

    constructor(
        pipelineName: string,
        options: FormPipelineOptions = {},
        stages: Array<FormProcessingPipelineStage<FormData, CustomContext, any, any>>,
    ) {
        this.pipelineName = pipelineName;
        this.options = { ...DEFAULT_FORM_PIPELINE_OPTIONS, ...options };
        this.stages = stages;
    }

    /**
     * Execute all stages of the form processing pipeline sequentially with the provided form data and context, returning an array of results for each stage.
     * @param formData The data submitted with the form that will be processed by the pipeline stages.
     * @param context The custom context object that will be passed to each stage of the pipeline.
     * @param formInstanceId The unique identifier for this instance of form processing, used for logging and tracking purposes.
     * @returns A promise that resolves to an array of results for each stage of the pipeline, indicating the success, failure, or skipping of each stage along with execution duration and any errors encountered.
     */
    async execute(
        formInstanceId: FormInstanceId,
        formData: FormData,
        context: CustomContext,
    ): Promise<FormProcessingPipelineStageResult[]> {
        const results: FormProcessingPipelineStageResult[] = [];
        for await (const stageResult of this.executeStages(formInstanceId, formData, context)) {
            results.push(stageResult);
        }
        return results;
    }

    /**
     * Execute the pipeline stages sequentially as an async generator, yielding results for each stage as they complete.
     * This allows for real-time processing and feedback on the execution of each stage, which can be useful for long-running pipelines or for providing progress updates to users.
     * @param formInstanceId The unique identifier for this instance of form processing, used for logging and tracking purposes.
     * @param formData The data submitted with the form that will be processed by the pipeline stages.
     * @param context The custom context object that will be passed to each stage of the pipeline.
     */
    async *executeStages(
        formInstanceId: FormInstanceId,
        formData: FormData,
        context: CustomContext,
    ): AsyncGenerator<FormProcessingPipelineStageResult> {
        let accumulatedOutput: any = {};

        for (const stage of this.stages) {
            const logger = AVUTLogger.getConsoleLogger(`${this.pipelineName} - ${stage.stageName}`);
            const stageContext: FormProcessingContext<FormData, CustomContext> = {
                ...context,
                logger,
                formInstanceId,
                formData,
            };

            if (stage.conditional && !stage.conditional(stageContext, accumulatedOutput)) {
                yield {
                    stageName: stage.stageName,
                    status: "skipped",
                    duration: 0,
                } satisfies FormProcessingPipelineStageResult;
                continue;
            }

            const startTime = Date.now();

            try {
                const stageOutput = await stage.stageFn(stageContext, accumulatedOutput);
                accumulatedOutput = { ...accumulatedOutput, ...(stageOutput ?? {}) };
            } catch (err) {
                const duration = Date.now() - startTime;
                const error = err instanceof Error ? err : new Error(String(err));
                yield {
                    stageName: stage.stageName,
                    status: "error",
                    error,
                    duration,
                } satisfies FormProcessingPipelineStageResult;

                // End the pipeline execution on error, as subsequent stages may depend on the output of this stage.
                return;
            }
            const duration = Date.now() - startTime;
            yield {
                stageName: stage.stageName,
                status: "success",
                duration,
            } satisfies FormProcessingPipelineStageResult;
        }

        if (this.options.saveStatus != "None") {
            await prisma.formInstance.update({
                where: { id: formInstanceId },
                data: { formStatus: "Processed" },
            });
        }
    }

    /**
     * Create a new FormProcessingPipelineBuilder instance for constructing a form processing pipeline with the specified name and form data type.
     * @param name The name of the form processing pipeline, used for logging and identification purposes.
     * @param options Optional configuration options for the pipeline, such tracking behavior or execution settings.
     * @returns A new instance of FormProcessingPipelineBuilder for constructing the pipeline.
     */
    static builder<FormData, CustomContext extends object = {}>(
        name: string,
        options: FormPipelineOptions = {},
    ): FormProcessingPipelineBuilder<FormData, CustomContext, {}> {
        return new FormProcessingPipelineBuilder<FormData, CustomContext, {}>(name, options, []);
    }
}

interface FormPipelineOptions {
    saveStatus?: "None" | "Final";
}

const DEFAULT_FORM_PIPELINE_OPTIONS: FormPipelineOptions = {
    saveStatus: "Final",
};

/**
 * Defines the context object that is passed to each stage function within the form processing pipeline. Merges the custom context provided when executing the pipeline with additional properties for logging, form instance identification, and access to the form data being processed.
 * @param FormData The shape of the form data being processed by this pipeline.
 * @param CustomContext The shape of the custom context object.
 *
 * @property logger An instance of AVUTLogger that is scoped to the current pipeline and stage, allowing for structured logging within each stage function.
 * @property formInstanceId The unique identifier for this instance of form processing, used for logging and tracking purposes.
 * @property formData The data submitted with the form that is being processed by the pipeline stages.
 */
type FormProcessingContext<FormData, CustomContext extends object> = CustomContext & {
    readonly logger: AVUTLogger;

    readonly formInstanceId: FormInstanceId;
    readonly formData: FormData;
};

/**
 * Defines a single stage within the form processing pipeline.
 *
 * @param FormData The shape of the form data being processed by this pipeline.
 * @param CustomContext The shape of the custom context object that is passed through each stage of the pipeline.
 * @param Input The shape of the input data that this stage function receives, which is typically the accumulated output from previous stages.
 * @param Output The shape of the output data that this stage function returns, which will be accumulated and passed as input to subsequent stages.
 *
 * @property stageName A descriptive name for this stage, used for logging and debugging purposes.
 * @property conditional An optional function that determines whether this stage should be executed based on the current context and accumulated output. If this function returns false, the stage will be skipped.
 * @property stageFn The asynchronous function that implements the processing logic for this stage. It receives the form processing context and the accumulated output from previous stages as input, and returns a promise that resolves to the output of this stage, which will be accumulated and passed to subsequent stages.
 */
interface FormProcessingPipelineStage<FormData, CustomContext extends object, Input, Output> {
    stageName: string;
    conditional?: (
        context: FormProcessingContext<FormData, CustomContext>,
        input: Input,
    ) => boolean;
    stageFn: (
        context: FormProcessingContext<FormData, CustomContext>,
        input: Input,
    ) => Promise<Output | void>;
}

/**
 * Defines the result of executing a single stage within the form processing pipeline.
 *
 * @property stageName The name of the stage that was executed, corresponding to the stageName defined in the FormProcessingPipelineStage.
 * @property status The status of the stage execution, which can be "success" if the stage completed successfully, "skipped" if the stage was conditionally skipped, or "error" if an error was encountered during execution.
 * @property duration The time taken to execute the stage, in milliseconds.
 * @property error An optional Error object that is included if the stage execution resulted in an error, providing details about the failure.
 */
export type FormProcessingPipelineStageResult = {
    stageName: string;
    duration: number;
} & ({ status: "success" } | { status: "skipped" } | { status: "error"; error: Error });

/**
 * Builder class for constructing instances of FormProcessingPipeline with a fluent API.
 * @param CustomContext The shape of the custom context object that is passed through each stage of the pipeline.
 * @param Output The accumulated output type that is built up through the stages of the pipeline, allowing for type-safe access to the outputs of previous stages in subsequent stages.
 */
class FormProcessingPipelineBuilder<FormData, CustomContext extends object, Output extends object> {
    constructor(
        readonly pipelineName: string,
        readonly options: FormPipelineOptions = {},
        private readonly stages: Array<
            FormProcessingPipelineStage<FormData, CustomContext, any, any>
        >,
    ) {}

    /**
     * Finalize the form processing pipeline and return an instance of FormProcessingPipeline that can be executed with form data and context. This method should be called after all desired stages have been added to the pipeline using the stage() method.
     * @returns An instance of FormProcessingPipeline that can be executed with form data and context.
     */
    build(): FormProcessingPipeline<FormData, CustomContext> {
        return new FormProcessingPipeline(this.pipelineName, this.options, this.stages);
    }

    /**
     * Add a conditional processing stage to the form processing pipeline, which will only be executed if the provided test function returns true for the given context and accumulated output. This allows for dynamic execution of stages based on the results of previous stages or properties of the form data and context.
     * @param args An object containing the stage name, test function, and stage function.
     * @returns A new FormProcessingPipelineBuilder instance with the added conditional stage, allowing for chaining of multiple stages.
     */
    conditionalStage<StageOutput extends object | void>(args: {
        stageName: string;
        test: (context: FormProcessingContext<FormData, CustomContext>, input: Output) => boolean;
        stageFn: (
            context: FormProcessingContext<FormData, CustomContext>,
            input: Output,
        ) => Promise<StageOutput | void>;
    }): FormProcessingPipelineBuilder<FormData, CustomContext, Output & Partial<StageOutput>> {
        const newStage: FormProcessingPipelineStage<FormData, CustomContext, Output, StageOutput> =
            {
                stageName: args.stageName,
                conditional: args.test,
                stageFn: args.stageFn,
            };
        return new FormProcessingPipelineBuilder(this.pipelineName, this.options, [
            ...this.stages,
            newStage,
        ]);
    }

    /**
     * Add a processing stage to the form processing pipeline.
     * @param stageName The name of the processing stage, used for logging and debugging purposes.
     * @param stageFn The function that implements the processing logic for this stage. It receives the form data and context as input and returns a promise that resolves to the output of this stage.
     * @returns A new FormProcessingPipelineBuilder instance with the added stage, allowing for chaining of multiple stages.
     */
    stage<StageOutput extends object | void>(args: {
        stageName: string;
        stageFn: (
            context: FormProcessingContext<FormData, CustomContext>,
            input: Output,
        ) => Promise<StageOutput | void>;
    }): FormProcessingPipelineBuilder<
        FormData,
        CustomContext,
        Output & (StageOutput extends object ? StageOutput : {})
    > {
        const newStage: FormProcessingPipelineStage<FormData, CustomContext, Output, StageOutput> =
            {
                stageName: args.stageName,
                stageFn: args.stageFn,
            };
        return new FormProcessingPipelineBuilder(this.pipelineName, this.options, [
            ...this.stages,
            newStage,
        ]);
    }
}
