import "@lovable.dev/ai-gateway";

/* The MIT License

Copyright (c) OpenAI (https://openai.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */
declare namespace ModelContract_1dcd13c2fce7d97b {
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AccessProgramsParam: {
            cyber?: components["schemas"]["CyberAccessProgramEnum"];
        };
        AdditionalToolsItemParam: {
            id?: string | null;
            
            role: "developer";
            tools: components["schemas"]["Tool"][];
            
            type: "additional_tools";
        };
        Annotation: components["schemas"]["FileCitationBody"] | components["schemas"]["UrlCitationBody"] | components["schemas"]["ContainerFileCitationBody"] | components["schemas"]["FilePath"];
        
        ApplyPatchCallOutputStatusParam: "completed" | "failed";
        
        ApplyPatchCallStatusParam: "in_progress" | "completed";
        
        ApplyPatchCreateFileOperationParam: {
            diff: string;
            path: string;
            
            type: "create_file";
        };
        
        ApplyPatchDeleteFileOperationParam: {
            path: string;
            
            type: "delete_file";
        };
        
        ApplyPatchOperationParam: components["schemas"]["ApplyPatchCreateFileOperationParam"] | components["schemas"]["ApplyPatchDeleteFileOperationParam"] | components["schemas"]["ApplyPatchUpdateFileOperationParam"];
        
        ApplyPatchToolCallItemParam: {
            call_id: string;
            caller?: components["schemas"]["ToolCallCallerParam"] | null;
            id?: string | null;
            operation: components["schemas"]["ApplyPatchOperationParam"];
            status: components["schemas"]["ApplyPatchCallStatusParam"];
            
            type: "apply_patch_call";
        };
        
        ApplyPatchToolCallOutputItemParam: {
            call_id: string;
            caller?: components["schemas"]["ToolCallCallerParam"] | null;
            id?: string | null;
            output?: string | null;
            status: components["schemas"]["ApplyPatchCallOutputStatusParam"];
            
            type: "apply_patch_call_output";
        };
        
        ApplyPatchToolParam: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            
            type: "apply_patch";
        };
        
        ApplyPatchUpdateFileOperationParam: {
            diff: string;
            path: string;
            
            type: "update_file";
        };
        ApproximateLocation: {
            city?: string | null;
            country?: string | null;
            region?: string | null;
            timezone?: string | null;
            
            type: "approximate";
        };
        
        AssistantInputTextContent: {
            annotations?: components["schemas"]["Annotation"][];
            logprobs?: components["schemas"]["LogProb"][];
            text: string;
            
            type: "output_text";
        };
        
        AutoCodeInterpreterToolParam: {
            file_ids?: string[];
            memory_limit?: components["schemas"]["ContainerMemoryLimit"] | null;
            network_policy?: components["schemas"]["ContainerNetworkPolicyDisabledParam"] | components["schemas"]["ContainerNetworkPolicyAllowlistParam"];
            
            type: "auto";
        };
        
        CallableToolAllowedCaller: "direct" | "programmatic";
        
        ChatCompletionMessageCustomToolCall: {
            custom: {
                input: string;
                name: string;
            };
            id: string;
            
            type: "custom";
        };
        
        ChatCompletionMessageToolCall: {
            function: {
                arguments: string;
                name: string;
            };
            id: string;
            
            type: "function";
        };
        ChatCompletionMessageToolCalls: (components["schemas"]["ChatCompletionMessageToolCall"] | components["schemas"]["ChatCompletionMessageCustomToolCall"])[];
        
        ChatCompletionRequestAssistantMessage: {
            audio?: never;
            content?: (string | components["schemas"]["ChatCompletionRequestAssistantMessageContentPart"][]) | null;
            function_call?: {
                arguments: string;
                name: string;
            } | null;
            name?: string;
            refusal?: string | null;
            
            role: "assistant";
            tool_calls?: components["schemas"]["ChatCompletionMessageToolCalls"];
        };
        ChatCompletionRequestAssistantMessageContentPart: components["schemas"]["ChatCompletionRequestMessageContentPartText"] | components["schemas"]["ChatCompletionRequestMessageContentPartRefusal"];
        
        ChatCompletionRequestDeveloperMessage: {
            content: string | components["schemas"]["ChatCompletionRequestMessageContentPartText"][];
            name?: string;
            
            role: "developer";
        };
        
        ChatCompletionRequestFunctionMessage: {
            content: string | null;
            name: string;
            
            role: "function";
        };
        ChatCompletionRequestMessage: components["schemas"]["ChatCompletionRequestDeveloperMessage"] | components["schemas"]["ChatCompletionRequestSystemMessage"] | components["schemas"]["ChatCompletionRequestUserMessage"] | components["schemas"]["ChatCompletionRequestAssistantMessage"] | components["schemas"]["ChatCompletionRequestToolMessage"] | components["schemas"]["ChatCompletionRequestFunctionMessage"];
        
        ChatCompletionRequestMessageContentPartFile: {
            file: {
                file_data?: string;
                file_id?: string;
                filename?: string;
            };
            prompt_cache_breakpoint?: components["schemas"]["ChatPromptCacheBreakpointParam"];
            
            type: "file";
        };
        
        ChatCompletionRequestMessageContentPartImage: {
            image_url: {
                
                detail?: "auto" | "low" | "high" | "original";
                
                url: string;
            };
            prompt_cache_breakpoint?: components["schemas"]["ChatPromptCacheBreakpointParam"];
            
            type: "image_url";
        };
        
        ChatCompletionRequestMessageContentPartRefusal: {
            refusal: string;
            
            type: "refusal";
        };
        
        ChatCompletionRequestMessageContentPartText: {
            prompt_cache_breakpoint?: components["schemas"]["ChatPromptCacheBreakpointParam"];
            text: string;
            
            type: "text";
        };
        
        ChatCompletionRequestSystemMessage: {
            content: string | components["schemas"]["ChatCompletionRequestSystemMessageContentPart"][];
            name?: string;
            
            role: "system";
        };
        ChatCompletionRequestSystemMessageContentPart: components["schemas"]["ChatCompletionRequestMessageContentPartText"];
        
        ChatCompletionRequestToolMessage: {
            content: string | components["schemas"]["ChatCompletionRequestToolMessageContentPart"][];
            
            role: "tool";
            tool_call_id: string;
        };
        ChatCompletionRequestToolMessageContentPart: components["schemas"]["ChatCompletionRequestMessageContentPartText"];
        
        ChatCompletionRequestUserMessage: {
            content: string | components["schemas"]["ChatCompletionRequestUserMessageContentPart"][];
            name?: string;
            
            role: "user";
        };
        ChatCompletionRequestUserMessageContentPart: components["schemas"]["ChatCompletionRequestMessageContentPartText"] | components["schemas"]["ChatCompletionRequestMessageContentPartImage"] | components["schemas"]["ChatCompletionRequestMessageContentPartFile"];
        ChatCompletionStreamOptions: {
            include_obfuscation?: boolean;
            include_usage?: boolean;
        } | null;
        
        ChatCompletionTool: {
            function: components["schemas"]["FunctionObject"];
            
            type: "function";
        };
        ChatEvent: components["schemas"]["Output_CreateChatCompletionStreamResponse"] | components["schemas"]["GatewayErrorResponse"];
        
        ChatPromptCacheBreakpointParam: {
            
            mode: "explicit";
            ttl?: components["schemas"]["ChatPromptCacheTTLEnum"];
        };
        
        ChatPromptCacheTTLEnum: "30m";
        ChatReasoningEffort: ("none" | "low" | "medium" | "high" | "xhigh") | null;
        ChatRequest: {
            audio?: never;
            frequency_penalty?: number | null;
            
            function_call?: "none";
            functions?: never;
            logit_bias?: {
                [key: string]: number;
            } | null;
            logprobs?: boolean | null;
            max_completion_tokens?: number | null;
            max_tokens?: never;
            messages: components["schemas"]["ChatCompletionRequestMessage"][];
            metadata?: components["schemas"]["Metadata"];
            modalities?: "text"[] | null;
            
            model: "openai/gpt-6.1-terra";
            moderation?: components["schemas"]["ModerationParam"] | null;
            n?: number | null;
            parallel_tool_calls?: components["schemas"]["ParallelToolCalls"];
            prediction?: components["schemas"]["PredictionContent"] | null;
            presence_penalty?: number | null;
            prompt_cache_key?: string | null;
            prompt_cache_options?: components["schemas"]["PromptCacheOptionsParam"];
            reasoning_effort?: components["schemas"]["ChatReasoningEffort"];
            response_format?: components["schemas"]["ResponseFormatText"] | components["schemas"]["ResponseFormatJsonSchema"] | components["schemas"]["ResponseFormatJsonObject"];
            safety_identifier?: string | null;
            seed?: number | null;
            service_tier?: components["schemas"]["ServiceTier"];
            stop?: components["schemas"]["StopConfiguration"];
            stream?: boolean | null;
            stream_options?: components["schemas"]["ChatCompletionStreamOptions"];
            temperature?: number | null;
            
            tool_choice?: "none";
            tools?: (components["schemas"]["ChatCompletionTool"] | components["schemas"]["CustomToolChatCompletions"])[];
            top_logprobs?: number | null;
            top_p?: number | null;
            
            user?: string | null;
            verbosity?: components["schemas"]["Verbosity"];
            web_search_options?: never;
        };
        ChatResponse: components["schemas"]["Output_CreateChatCompletionResponse"];
        
        ClickButtonType: "left" | "right" | "wheel" | "back" | "forward";
        
        ClickParam: {
            button: components["schemas"]["ClickButtonType"];
            keys?: string[] | null;
            
            type: "click";
            x: number;
            y: number;
        };
        
        CodeInterpreterOutputImage: {
            
            type: "image";
            
            url: string;
        };
        
        CodeInterpreterOutputLogs: {
            logs: string;
            
            type: "logs";
        };
        
        CodeInterpreterTool: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            container: string | components["schemas"]["AutoCodeInterpreterToolParam"];
            
            type: "code_interpreter";
        };
        
        CodeInterpreterToolCall: {
            code: string | null;
            container_id: string;
            id: string;
            outputs: (components["schemas"]["CodeInterpreterOutputLogs"] | components["schemas"]["CodeInterpreterOutputImage"])[] | null;
            
            status: "in_progress" | "completed" | "incomplete" | "interpreting" | "failed";
            
            type: "code_interpreter_call";
        };
        
        CompactionSummaryItemParam: {
            encrypted_content: string;
            id?: string | null;
            
            type: "compaction";
        };
        
        CompactionTriggerItemParam: {
            id?: string | null;
            
            type: "compaction_trigger";
        };
        
        ComparisonFilter: {
            key: string;
            
            type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin";
            value: string | number | boolean | (string | number)[];
        };
        
        CompoundFilter: {
            filters: (components["schemas"]["ComparisonFilter"] | components["schemas"]["CompoundFilter"])[];
            
            type: "and" | "or";
        };
        ComputerAction: components["schemas"]["ClickParam"] | components["schemas"]["DoubleClickAction"] | components["schemas"]["DragParam"] | components["schemas"]["KeyPressAction"] | components["schemas"]["MoveParam"] | components["schemas"]["ScreenshotParam"] | components["schemas"]["ScrollParam"] | components["schemas"]["TypeParam"] | components["schemas"]["WaitParam"];
        
        ComputerActionList: components["schemas"]["ComputerAction"][];
        
        ComputerCallOutputItemParam: {
            acknowledged_safety_checks?: components["schemas"]["ComputerCallSafetyCheckParam"][] | null;
            call_id: string;
            id?: string | null;
            output: components["schemas"]["ComputerScreenshotImage"];
            status?: components["schemas"]["FunctionCallItemStatus"] | null;
            
            type: "computer_call_output";
        };
        ComputerCallSafetyCheckParam: {
            code?: string | null;
            id: string;
            message?: string | null;
        };
        
        ComputerEnvironment: "windows" | "mac" | "linux" | "ubuntu" | "browser";
        ComputerScreenshotImage: {
            file_id?: string;
            
            image_url?: string;
            
            type: "computer_screenshot";
        };
        
        ComputerTool: {
            
            type: "computer";
        };
        
        ComputerToolCall: {
            action?: components["schemas"]["ComputerAction"];
            actions?: components["schemas"]["ComputerActionList"];
            call_id: string;
            id: string;
            pending_safety_checks: components["schemas"]["ComputerCallSafetyCheckParam"][];
            
            status: "in_progress" | "completed" | "incomplete";
            
            type: "computer_call";
        };
        
        ComputerUsePreviewTool: {
            display_height: number;
            display_width: number;
            environment: components["schemas"]["ComputerEnvironment"];
            
            type: "computer_use_preview";
        };
        ContainerAutoParam: {
            file_ids?: string[];
            memory_limit?: components["schemas"]["ContainerMemoryLimit"] | null;
            network_policy?: components["schemas"]["ContainerNetworkPolicyDisabledParam"] | components["schemas"]["ContainerNetworkPolicyAllowlistParam"];
            skills?: (components["schemas"]["SkillReferenceParam"] | components["schemas"]["InlineSkillParam"])[];
            
            type: "container_auto";
        };
        
        ContainerFileCitationBody: {
            container_id: string;
            end_index: number;
            file_id: string;
            filename: string;
            start_index: number;
            
            type: "container_file_citation";
        };
        
        ContainerMemoryLimit: "1g" | "4g" | "16g" | "64g";
        ContainerNetworkPolicyAllowlistParam: {
            allowed_domains: string[];
            domain_secrets?: components["schemas"]["ContainerNetworkPolicyDomainSecretParam"][];
            
            type: "allowlist";
        };
        ContainerNetworkPolicyDisabledParam: {
            
            type: "disabled";
        };
        ContainerNetworkPolicyDomainSecretParam: {
            domain: string;
            name: string;
            value: string;
        };
        ContainerReferenceParam: {
            container_id: string;
            
            type: "container_reference";
        };
        ContextManagementParam: {
            compact_threshold?: number | null;
            type: string;
        };
        
        CoordParam: {
            x: number;
            y: number;
        };
        
        CustomGrammarFormatParam: {
            definition: string;
            syntax: components["schemas"]["GrammarSyntax1"];
            
            type: "grammar";
        };
        
        CustomTextFormatParam: {
            
            type: "text";
        };
        
        CustomToolCall: {
            async?: boolean;
            call_id: string;
            caller?: components["schemas"]["ToolCallCaller"] | null;
            id?: string;
            input: string;
            name: string;
            namespace?: string;
            
            type: "custom_tool_call";
        };
        
        CustomToolCallOutput: {
            call_id: string;
            caller?: components["schemas"]["ToolCallCallerParam"] | null;
            id?: string;
            output: string | components["schemas"]["FunctionAndCustomToolCallOutput"][];
            
            type: "custom_tool_call_output";
        };
        
        CustomToolChatCompletions: {
            
            custom: {
                format?: {
                    
                    type: "text";
                } | {
                    
                    grammar: {
                        definition: string;
                        
                        syntax: "lark" | "regex";
                    };
                    
                    type: "grammar";
                };
                name: string;
            };
            
            type: "custom";
        };
        
        CustomToolParam: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            async?: boolean;
            defer_loading?: boolean;
            format?: components["schemas"]["CustomTextFormatParam"] | components["schemas"]["CustomGrammarFormatParam"];
            name: string;
            
            type: "custom";
        };
        
        CyberAccessProgramEnum: "standard" | "daybreak_blue" | "daybreak_red";
        
        DetailEnum: "low" | "high" | "auto" | "original";
        DirectToolCallCaller: {
            
            type: "direct";
        };
        DirectToolCallCallerParam: {
            
            type: "direct";
        };
        
        DoubleClickAction: {
            keys: string[] | null;
            
            type: "double_click";
            x: number;
            y: number;
        };
        
        DragParam: {
            keys?: string[] | null;
            path: components["schemas"]["CoordParam"][];
            
            type: "drag";
        };
        
        EasyInputMessage: {
            
            content: string;
            phase?: components["schemas"]["MessagePhase"] | null;
            
            role: "user" | "assistant" | "system" | "developer";
            
            type?: "message";
        } | {
            content: string | components["schemas"]["InputMessageContentList"];
            phase?: components["schemas"]["MessagePhase"] | null;
            
            role: "user" | "system" | "developer";
            
            type?: "message";
        } | {
            content: (components["schemas"]["AssistantInputTextContent"] | components["schemas"]["RefusalContent"])[];
            phase?: components["schemas"]["MessagePhase"] | null;
            
            role: "assistant";
            
            type?: "message";
        };
        EmptyModelParam: Record<string, never>;
        
        FileCitationBody: {
            file_id: string;
            filename: string;
            index: number;
            
            type: "file_citation";
        };
        
        FileDetailEnum: "auto" | "low" | "high";
        
        FileInputDetail: "auto" | "low" | "high";
        
        FilePath: {
            file_id: string;
            index: number;
            
            type: "file_path";
        };
        
        FileSearchTool: {
            filters?: components["schemas"]["Filters"] | null;
            max_num_results?: number;
            ranking_options?: components["schemas"]["RankingOptions"];
            
            type: "file_search";
            vector_store_ids: string[];
        };
        
        FileSearchToolCall: {
            id: string;
            queries: string[];
            results?: {
                attributes?: components["schemas"]["VectorStoreFileAttributes"];
                file_id?: string;
                filename?: string;
                
                score?: number;
                text?: string;
            }[] | null;
            
            status: "in_progress" | "searching" | "completed" | "incomplete" | "failed";
            
            type: "file_search_call";
        };
        Filters: components["schemas"]["ComparisonFilter"] | components["schemas"]["CompoundFilter"];
        FunctionAndCustomToolCallOutput: components["schemas"]["InputTextContent"] | components["schemas"]["InputImageContent"] | components["schemas"]["InputFileContent"];
        
        FunctionCallItemStatus: "in_progress" | "completed" | "incomplete";
        
        FunctionCallOutputItemParam: {
            call_id?: string | null;
            caller?: components["schemas"]["ToolCallCallerParam"] | null;
            id?: string | null;
            name?: string | null;
            namespace?: string | null;
            output: string | (components["schemas"]["InputTextContentParam"] | components["schemas"]["InputImageContentParamAutoParam"] | components["schemas"]["InputFileContentParam"])[];
            status?: components["schemas"]["FunctionCallItemStatus"] | null;
            
            type: "function_call_output";
        };
        FunctionObject: {
            name: string;
            parameters?: components["schemas"]["FunctionParameters"];
            strict?: boolean | null;
        };
        FunctionParameters: {
            [key: string]: unknown;
        };
        
        FunctionShellActionParam: {
            commands: string[];
            max_output_length?: number | null;
            timeout_ms?: number | null;
        };
        
        FunctionShellCallItemParam: {
            action: components["schemas"]["FunctionShellActionParam"];
            call_id: string;
            caller?: components["schemas"]["ToolCallCallerParam"] | null;
            environment?: (components["schemas"]["LocalEnvironmentParam"] | components["schemas"]["ContainerReferenceParam"]) | null;
            id?: string | null;
            status?: components["schemas"]["FunctionShellCallItemStatus"] | null;
            
            type: "shell_call";
        };
        
        FunctionShellCallItemStatus: "in_progress" | "completed" | "incomplete";
        
        FunctionShellCallOutputContentParam: {
            outcome: components["schemas"]["FunctionShellCallOutputOutcomeParam"];
            stderr: string;
            stdout: string;
        };
        
        FunctionShellCallOutputExitOutcomeParam: {
            exit_code: number;
            
            type: "exit";
        };
        
        FunctionShellCallOutputItemParam: {
            call_id: string;
            caller?: components["schemas"]["ToolCallCallerParam"] | null;
            id?: string | null;
            max_output_length?: number | null;
            output: components["schemas"]["FunctionShellCallOutputContentParam"][];
            status?: components["schemas"]["FunctionShellCallItemStatus"] | null;
            
            type: "shell_call_output";
        };
        
        FunctionShellCallOutputOutcomeParam: components["schemas"]["FunctionShellCallOutputTimeoutOutcomeParam"] | components["schemas"]["FunctionShellCallOutputExitOutcomeParam"];
        
        FunctionShellCallOutputTimeoutOutcomeParam: {
            
            type: "timeout";
        };
        
        FunctionShellToolParam: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            environment?: (components["schemas"]["ContainerAutoParam"] | components["schemas"]["LocalEnvironmentParam"] | components["schemas"]["ContainerReferenceParam"]) | null;
            
            type: "shell";
        };
        
        FunctionTool: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            async?: boolean;
            defer_loading?: boolean;
            name: string;
            output_schema?: {
                [key: string]: unknown;
            } | null;
            parameters: {
                [key: string]: unknown;
            } | null;
            strict: boolean | null;
            
            type: "function";
        };
        
        FunctionToolCall: {
            arguments: string;
            async?: boolean;
            call_id: string;
            caller?: components["schemas"]["ToolCallCaller"] | null;
            id?: string;
            name: string;
            namespace?: string;
            
            status?: "in_progress" | "completed" | "incomplete";
            
            type: "function_call";
        };
        FunctionToolParam: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            async?: boolean;
            defer_loading?: boolean;
            name: string;
            output_schema?: {
                [key: string]: unknown;
            } | null;
            parameters?: components["schemas"]["EmptyModelParam"] | null;
            strict?: boolean | null;
            
            type: "function";
        };
        GatewayErrorResponse: {
            error: {
                code?: string | null;
                message: string;
                metadata?: {
                    provider_name?: unknown;
                    raw?: unknown;
                };
                param?: unknown;
                type?: string;
            };
            usage?: {
                [key: string]: unknown;
            };
        };
        
        GrammarSyntax1: "lark" | "regex";
        HTTPError: {
            code: number;
            message: string;
            
            type: "http_error";
        };
        HybridSearchOptions: {
            embedding_weight: number;
            text_weight: number;
        };
        
        ImageBackground: "transparent" | "opaque" | "auto";
        
        ImageDetail: "low" | "high" | "auto" | "original";
        
        ImageGenActionEnum: "generate" | "edit" | "auto";
        
        ImageGenTool: {
            action?: components["schemas"]["ImageGenActionEnum"];
            
            background?: "transparent" | "opaque" | "auto";
            input_fidelity?: components["schemas"]["InputFidelity"] | null;
            input_image_mask?: {
                file_id?: string;
                image_url?: string;
            };
            model?: string | ("gpt-image-1" | "gpt-image-1-mini" | "gpt-image-1.5" | "gpt-image-2" | "gpt-image-2-2026-04-21" | "gpt-image-2.5-sunburst" | "gpt-image-2.5-sunburst-2026-09-08" | "gpt-image-2.5-flare" | "gpt-image-2.5-flare-2026-09-08");
            
            moderation?: "auto" | "low";
            
            output_compression?: number;
            
            output_format?: "png" | "webp" | "jpeg";
            
            partial_images?: number;
            
            quality?: "low" | "medium" | "high" | "xhigh" | "max" | "auto";
            
            size?: string | ("1024x1024" | "1024x1536" | "1536x1024" | "auto");
            
            type: "image_generation";
        };
        
        ImageGenToolCall: {
            action?: components["schemas"]["ImageGenActionEnum"] | null;
            background?: components["schemas"]["ImageBackground"] | null;
            id: string;
            output_format?: components["schemas"]["ImageOutputFormat"] | null;
            quality?: ("low" | "medium" | "high" | "xhigh" | "max" | "auto") | null;
            result: string | null;
            revised_prompt?: string | null;
            size?: (string | ("1024x1024" | "1024x1536" | "1536x1024")) | null;
            
            status: "in_progress" | "completed" | "generating" | "failed";
            
            type: "image_generation_call";
        };
        
        ImageOutputFormat: "png" | "webp" | "jpeg";
        
        IncludeEnum: "file_search_call.results" | "web_search_call.results" | "web_search_call.action.sources" | "message.input_image.image_url" | "computer_call_output.output.image_url" | "code_interpreter_call.outputs" | "reasoning.encrypted_content" | "message.output_text.logprobs";
        InlineSkillParam: {
            name: string;
            source: components["schemas"]["InlineSkillSourceParam"];
            
            type: "inline";
        };
        InlineSkillSourceParam: {
            data: string;
            
            media_type: "application/zip";
            
            type: "base64";
        };
        InputContent: components["schemas"]["InputTextContent"] | components["schemas"]["InputImageContent"] | components["schemas"]["InputFileContent"];
        
        InputFidelity: "high" | "low";
        
        InputFileContent: {
            detail?: components["schemas"]["FileInputDetail"];
            file_data?: string;
            file_id?: string | null;
            
            file_url?: string;
            filename?: string;
            prompt_cache_breakpoint?: components["schemas"]["PromptCacheBreakpointConfig"];
            
            type: "input_file";
        };
        
        InputFileContentParam: {
            detail?: components["schemas"]["FileDetailEnum"];
            file_data?: string | null;
            file_id?: string | null;
            file_url?: string | null;
            filename?: string | null;
            prompt_cache_breakpoint?: components["schemas"]["PromptCacheBreakpointParam"] | null;
            
            type: "input_file";
        };
        
        InputImageContent: {
            detail: components["schemas"]["ImageDetail"];
            file_id?: string | null;
            image_url?: string | null;
            prompt_cache_breakpoint?: components["schemas"]["PromptCacheBreakpointConfig"];
            
            type: "input_image";
        };
        
        InputImageContentParamAutoParam: {
            detail?: components["schemas"]["DetailEnum"] | null;
            file_id?: string | null;
            image_url?: string | null;
            prompt_cache_breakpoint?: components["schemas"]["PromptCacheBreakpointParam"] | null;
            
            type: "input_image";
        };
        InputItem: components["schemas"]["EasyInputMessage"] | components["schemas"]["Item"] | components["schemas"]["CompactionTriggerItemParam"] | components["schemas"]["ProgramItemParam"] | components["schemas"]["ProgramOutputItemParam"];
        
        InputMessage: {
            content: components["schemas"]["InputMessageContentList"];
            
            role: "user" | "system" | "developer";
            
            status?: "in_progress" | "completed" | "incomplete";
            
            type?: "message";
        };
        
        InputMessageContentList: components["schemas"]["InputContent"][];
        InputParam: string | components["schemas"]["InputItem"][];
        
        InputTextContent: {
            prompt_cache_breakpoint?: components["schemas"]["PromptCacheBreakpointConfig"];
            text: string;
            
            type: "input_text";
        };
        
        InputTextContentParam: {
            prompt_cache_breakpoint?: components["schemas"]["PromptCacheBreakpointParam"] | null;
            text: string;
            
            type: "input_text";
        };
        Item: components["schemas"]["InputMessage"] | components["schemas"]["OutputMessage"] | components["schemas"]["FileSearchToolCall"] | components["schemas"]["ComputerToolCall"] | components["schemas"]["ComputerCallOutputItemParam"] | components["schemas"]["WebSearchToolCall"] | components["schemas"]["FunctionToolCall"] | components["schemas"]["FunctionCallOutputItemParam"] | components["schemas"]["ToolSearchCallItemParam"] | components["schemas"]["ToolSearchOutputItemParam"] | components["schemas"]["AdditionalToolsItemParam"] | components["schemas"]["ResponseConfigurationUpdateItemParam"] | components["schemas"]["ReasoningItem"] | components["schemas"]["CompactionSummaryItemParam"] | components["schemas"]["ImageGenToolCall"] | components["schemas"]["CodeInterpreterToolCall"] | components["schemas"]["LocalShellToolCall"] | components["schemas"]["LocalShellToolCallOutput"] | components["schemas"]["FunctionShellCallItemParam"] | components["schemas"]["FunctionShellCallOutputItemParam"] | components["schemas"]["ApplyPatchToolCallItemParam"] | components["schemas"]["ApplyPatchToolCallOutputItemParam"] | components["schemas"]["MCPListTools"] | components["schemas"]["MCPApprovalRequest"] | components["schemas"]["MCPApprovalResponse"] | components["schemas"]["MCPToolCall"] | components["schemas"]["CustomToolCallOutput"] | components["schemas"]["CustomToolCall"];
        
        KeyPressAction: {
            keys: string[];
            
            type: "keypress";
        };
        LocalEnvironmentParam: {
            skills?: components["schemas"]["LocalSkillParam"][];
            
            type: "local";
        };
        
        LocalShellExecAction: {
            command: string[];
            env: {
                [key: string]: string;
            };
            timeout_ms?: number | null;
            
            type: "exec";
            user?: string | null;
            working_directory?: string | null;
        };
        
        LocalShellToolCall: {
            action: components["schemas"]["LocalShellExecAction"];
            call_id: string;
            id: string;
            
            status: "in_progress" | "completed" | "incomplete";
            
            type: "local_shell_call";
        };
        
        LocalShellToolCallOutput: {
            id: string;
            output: string;
            status?: ("in_progress" | "completed" | "incomplete") | null;
            
            type: "local_shell_call_output";
        };
        
        LocalShellToolParam: {
            
            type: "local_shell";
        };
        LocalSkillParam: {
            name: string;
            path: string;
        };
        
        LogProb: {
            bytes: number[];
            logprob: number;
            token: string;
            top_logprobs: components["schemas"]["TopLogProb"][];
        };
        
        MCPApprovalRequest: {
            arguments: string;
            id: string;
            name: string;
            server_label: string;
            
            type: "mcp_approval_request";
        };
        
        MCPApprovalResponse: {
            approval_request_id: string;
            approve: boolean;
            id?: string | null;
            reason?: string | null;
            
            type: "mcp_approval_response";
        };
        
        MCPListTools: {
            error?: string | null;
            id: string;
            server_label: string;
            tools: components["schemas"]["MCPListToolsTool"][];
            
            type: "mcp_list_tools";
        };
        
        MCPListToolsTool: {
            annotations?: Record<string, never> | null;
            input_schema: Record<string, never>;
            name: string;
        };
        MCPProtocolError: {
            code: number;
            message: string;
            
            type: "mcp_protocol_error";
        };
        
        MCPTool: {
            allowed_callers?: components["schemas"]["CallableToolAllowedCaller"][] | null;
            allowed_tools?: (string[] | components["schemas"]["MCPToolFilter"]) | null;
            authorization?: string;
            
            connector_id?: "connector_dropbox" | "connector_gmail" | "connector_googlecalendar" | "connector_googledrive" | "connector_microsoftteams" | "connector_outlookcalendar" | "connector_outlookemail" | "connector_sharepoint";
            defer_loading?: boolean;
            headers?: {
                [key: string]: string;
            } | null;
            require_approval?: ({
                always?: components["schemas"]["MCPToolFilter"];
                never?: components["schemas"]["MCPToolFilter"];
            } | ("always" | "never")) | null;
            server_description?: string;
            server_label: string;
            
            server_url?: string;
            tunnel_id?: string;
            
            type: "mcp";
        };
        
        MCPToolCall: {
            approval_request_id?: string | null;
            arguments: string;
            error?: components["schemas"]["MCPToolCallError"] | null;
            id: string;
            name: string;
            output?: string | null;
            server_label: string;
            status?: components["schemas"]["MCPToolCallStatus"];
            
            type: "mcp_call";
        };
        MCPToolCallError: components["schemas"]["MCPProtocolError"] | components["schemas"]["MCPToolExecutionError"] | components["schemas"]["HTTPError"];
        
        MCPToolCallStatus: "in_progress" | "completed" | "incomplete" | "calling" | "failed";
        MCPToolExecutionError: {
            content: unknown;
            
            type: "mcp_tool_execution_error";
        };
        
        MCPToolFilter: {
            read_only?: boolean;
            
            tool_names?: string[];
        };
        
        MessagePhase: "commentary" | "final_answer";
        Metadata: {
            [key: string]: string;
        } | null;
        ModerationConfigParam: {
            mode: components["schemas"]["ModerationMode"];
        };
        
        ModerationMode: "score" | "block";
        ModerationParam: {
            model: string;
            policy?: components["schemas"]["ModerationPolicyParam"] | null;
        };
        ModerationPolicyParam: {
            input?: components["schemas"]["ModerationConfigParam"] | null;
            output?: components["schemas"]["ModerationConfigParam"] | null;
        };
        
        MoveParam: {
            keys?: string[] | null;
            
            type: "move";
            x: number;
            y: number;
        };
        
        NamespaceToolParam: {
            name: string;
            tools: (components["schemas"]["FunctionToolParam"] | components["schemas"]["CustomToolParam"])[];
            
            type: "namespace";
        };
        Output__MisalignmentErrorType: string | ("potentially_unintended_data_transfer" | "potentially_unintended_data_access" | "potentially_unintended_destructive_activity" | "other");
        Output__MisalignmentSteer: {
            message: string;
        };
        Output_AccessProgramsBody: {
            cyber: components["schemas"]["Output_CyberAccessProgramEnum"];
        };
        Output_AdditionalTools: {
            id: string;
            role: components["schemas"]["Output_MessageRole"];
            tools: components["schemas"]["Output_Tool"][];
            
            type: "additional_tools";
        };
        Output_AdditionalToolsItemParam: {
            id?: string | null;
            
            role: "developer";
            tools: components["schemas"]["Output_Tool"][];
            
            type: "additional_tools";
        };
        Output_Annotation: components["schemas"]["Output_FileCitationBody"] | components["schemas"]["Output_UrlCitationBody"] | components["schemas"]["Output_ContainerFileCitationBody"] | components["schemas"]["Output_FilePath"];
        
        Output_ApplyPatchCallOutputStatus: "completed" | "failed";
        
        Output_ApplyPatchCallOutputStatusParam: "completed" | "failed";
        
        Output_ApplyPatchCallStatus: "in_progress" | "completed";
        
        Output_ApplyPatchCallStatusParam: "in_progress" | "completed";
        
        Output_ApplyPatchCreateFileOperation: {
            diff: string;
            path: string;
            
            type: "create_file";
        };
        
        Output_ApplyPatchCreateFileOperationParam: {
            diff: string;
            path: string;
            
            type: "create_file";
        };
        
        Output_ApplyPatchDeleteFileOperation: {
            path: string;
            
            type: "delete_file";
        };
        
        Output_ApplyPatchDeleteFileOperationParam: {
            path: string;
            
            type: "delete_file";
        };
        
        Output_ApplyPatchOperationParam: components["schemas"]["Output_ApplyPatchCreateFileOperationParam"] | components["schemas"]["Output_ApplyPatchDeleteFileOperationParam"] | components["schemas"]["Output_ApplyPatchUpdateFileOperationParam"];
        
        Output_ApplyPatchToolCall: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCaller"] | null;
            created_by?: string;
            id: string;
            
            operation: components["schemas"]["Output_ApplyPatchCreateFileOperation"] | components["schemas"]["Output_ApplyPatchDeleteFileOperation"] | components["schemas"]["Output_ApplyPatchUpdateFileOperation"];
            status: components["schemas"]["Output_ApplyPatchCallStatus"];
            
            type: "apply_patch_call";
        };
        
        Output_ApplyPatchToolCallItemParam: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            id?: string | null;
            operation: components["schemas"]["Output_ApplyPatchOperationParam"];
            status: components["schemas"]["Output_ApplyPatchCallStatusParam"];
            
            type: "apply_patch_call";
        };
        
        Output_ApplyPatchToolCallOutput: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCaller"] | null;
            created_by?: string;
            id: string;
            output?: string | null;
            status: components["schemas"]["Output_ApplyPatchCallOutputStatus"];
            
            type: "apply_patch_call_output";
        };
        
        Output_ApplyPatchToolCallOutputItemParam: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            id?: string | null;
            output?: string | null;
            status: components["schemas"]["Output_ApplyPatchCallOutputStatusParam"];
            
            type: "apply_patch_call_output";
        };
        
        Output_ApplyPatchToolParam: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            
            type: "apply_patch";
        };
        
        Output_ApplyPatchUpdateFileOperation: {
            diff: string;
            path: string;
            
            type: "update_file";
        };
        
        Output_ApplyPatchUpdateFileOperationParam: {
            diff: string;
            path: string;
            
            type: "update_file";
        };
        Output_ApproximateLocation: {
            city?: string | null;
            country?: string | null;
            region?: string | null;
            timezone?: string | null;
            
            type: "approximate";
        };
        
        Output_AutoCodeInterpreterToolParam: {
            file_ids?: string[];
            memory_limit?: components["schemas"]["Output_ContainerMemoryLimit"] | null;
            network_policy?: components["schemas"]["Output_ContainerNetworkPolicyDisabledParam"] | components["schemas"]["Output_ContainerNetworkPolicyAllowlistParam"];
            
            type: "auto";
        };
        
        Output_CacheMissReasonTypeEnum: "model_changed" | "prompt_cache_key_changed" | "tools_changed" | "text_format_changed" | "reasoning_effort_changed" | "verbosity_changed" | "context_compacted" | "input_changed" | "service_tier_changed";
        
        Output_CallableToolAllowedCaller: "direct" | "programmatic";
        
        Output_ChatCompletionMessageCustomToolCall: {
            custom: {
                input: string;
                name: string;
            };
            id: string;
            
            type: "custom";
        };
        
        Output_ChatCompletionMessageToolCall: {
            function: {
                arguments: string;
                name: string;
            };
            id: string;
            
            type: "function";
        };
        Output_ChatCompletionMessageToolCallChunk: {
            function?: {
                arguments?: string;
                name?: string;
            };
            id?: string;
            index: number;
            
            type?: "function";
        };
        Output_ChatCompletionMessageToolCalls: (components["schemas"]["Output_ChatCompletionMessageToolCall"] | components["schemas"]["Output_ChatCompletionMessageCustomToolCall"])[];
        Output_ChatCompletionModeration: {
            input: components["schemas"]["Output_ChatCompletionModerationResults"] | components["schemas"]["Output_ChatCompletionModerationError"];
            output: components["schemas"]["Output_ChatCompletionModerationResults"] | components["schemas"]["Output_ChatCompletionModerationError"];
        };
        Output_ChatCompletionModerationError: {
            code: string;
            message: string;
            
            type: "error";
        };
        Output_ChatCompletionModerationResults: {
            model: string;
            results: components["schemas"]["Output_ModerationResultBody"][];
            
            type: "moderation_results";
        };
        Output_ChatCompletionResponseMessage: {
            annotations?: {
                
                type: "url_citation";
                url_citation: {
                    end_index: number;
                    start_index: number;
                    title: string;
                    
                    url: string;
                };
            }[];
            audio?: {
                data: string;
                
                expires_at: number;
                id: string;
                transcript: string;
            } | null;
            content: string | null;
            
            function_call?: {
                arguments: string;
                name: string;
            } | null;
            images?: {
                image_url: {
                    url: string;
                };
                
                type: "image_url";
            }[];
            reasoning?: string | null;
            reasoning_details?: {
                data?: string;
                format?: string;
                id?: string;
                index: number;
                signature?: string;
                text?: string;
                type: string;
            }[];
            refusal?: string | null;
            
            role: "assistant";
            tool_calls?: components["schemas"]["Output_ChatCompletionMessageToolCalls"] | null;
        };
        Output_ChatCompletionStreamResponseDelta: {
            content?: string | null;
            
            function_call?: {
                arguments?: string;
                name?: string;
            };
            images?: {
                image_url: {
                    url: string;
                };
                
                type: "image_url";
            }[];
            reasoning?: string | null;
            reasoning_details?: {
                data?: string;
                format?: string;
                id?: string;
                index: number;
                signature?: string;
                text?: string;
                type: string;
            }[];
            refusal?: string | null;
            
            role?: "developer" | "system" | "user" | "assistant" | "tool";
            tool_calls?: components["schemas"]["Output_ChatCompletionMessageToolCallChunk"][];
        };
        Output_ChatCompletionTokenLogprob: {
            bytes: number[] | null;
            logprob: number;
            token: string;
            top_logprobs: {
                bytes: number[] | null;
                logprob: number;
                token: string;
            }[];
        };
        
        Output_ClickButtonType: "left" | "right" | "wheel" | "back" | "forward";
        
        Output_ClickParam: {
            button: components["schemas"]["Output_ClickButtonType"];
            keys?: string[] | null;
            
            type: "click";
            x: number;
            y: number;
        };
        
        Output_CodeInterpreterOutputImage: {
            
            type: "image";
            
            url: string;
        };
        
        Output_CodeInterpreterOutputLogs: {
            logs: string;
            
            type: "logs";
        };
        
        Output_CodeInterpreterTool: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            container: string | components["schemas"]["Output_AutoCodeInterpreterToolParam"];
            
            type: "code_interpreter";
        };
        
        Output_CodeInterpreterToolCall: {
            code: string | null;
            container_id: string;
            id: string;
            outputs: (components["schemas"]["Output_CodeInterpreterOutputLogs"] | components["schemas"]["Output_CodeInterpreterOutputImage"])[] | null;
            
            status: "in_progress" | "completed" | "incomplete" | "interpreting" | "failed";
            
            type: "code_interpreter_call";
        };
        
        Output_CompactionBody: {
            created_by?: string;
            encrypted_content: string;
            id: string;
            
            type: "compaction";
        };
        
        Output_CompactionSummaryItemParam: {
            encrypted_content: string;
            id?: string | null;
            
            type: "compaction";
        };
        
        Output_CompactionTriggerItemParam: {
            id?: string | null;
            
            type: "compaction_trigger";
        };
        
        Output_ComparisonFilter: {
            key: string;
            
            type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin";
            value: string | number | boolean | (string | number)[];
        };
        Output_CompletionUsage: {
            
            completion_tokens: number;
            completion_tokens_details?: {
                
                accepted_prediction_tokens?: number;
                
                audio_tokens?: number;
                image_tokens?: number;
                
                reasoning_tokens?: number;
                
                rejected_prediction_tokens?: number;
                text_tokens?: number;
            };
            
            prompt_tokens: number;
            prompt_tokens_details?: {
                
                audio_tokens?: number;
                
                cache_write_tokens?: number;
                
                cached_tokens?: number;
                image_tokens?: number;
                text_tokens?: number;
                video_tokens?: number;
            };
            
            total_tokens: number;
        };
        
        Output_CompoundFilter: {
            filters: (components["schemas"]["Output_ComparisonFilter"] | components["schemas"]["Output_CompoundFilter"])[];
            
            type: "and" | "or";
        };
        Output_ComputerAction: components["schemas"]["Output_ClickParam"] | components["schemas"]["Output_DoubleClickAction"] | components["schemas"]["Output_DragParam"] | components["schemas"]["Output_KeyPressAction"] | components["schemas"]["Output_MoveParam"] | components["schemas"]["Output_ScreenshotParam"] | components["schemas"]["Output_ScrollParam"] | components["schemas"]["Output_TypeParam"] | components["schemas"]["Output_WaitParam"];
        
        Output_ComputerActionList: components["schemas"]["Output_ComputerAction"][];
        
        Output_ComputerCallOutputItemParam: {
            acknowledged_safety_checks?: components["schemas"]["Output_ComputerCallSafetyCheckParam"][] | null;
            call_id: string;
            id?: string | null;
            output: components["schemas"]["Output_ComputerScreenshotImage"];
            status?: components["schemas"]["Output_FunctionCallItemStatus"] | null;
            
            type: "computer_call_output";
        };
        
        Output_ComputerCallOutputStatus: "completed" | "incomplete" | "failed";
        Output_ComputerCallSafetyCheckParam: {
            code?: string | null;
            id: string;
            message?: string | null;
        };
        
        Output_ComputerEnvironment: "windows" | "mac" | "linux" | "ubuntu" | "browser";
        Output_ComputerScreenshotImage: {
            file_id?: string;
            
            image_url?: string;
            
            type: "computer_screenshot";
        };
        
        Output_ComputerTool: {
            
            type: "computer";
        };
        
        Output_ComputerToolCall: {
            action?: components["schemas"]["Output_ComputerAction"];
            actions?: components["schemas"]["Output_ComputerActionList"];
            call_id: string;
            id: string;
            pending_safety_checks: components["schemas"]["Output_ComputerCallSafetyCheckParam"][];
            
            status: "in_progress" | "completed" | "incomplete";
            
            type: "computer_call";
        };
        
        Output_ComputerToolCallOutput: {
            acknowledged_safety_checks?: components["schemas"]["Output_ComputerCallSafetyCheckParam"][];
            call_id: string;
            id?: string;
            output: components["schemas"]["Output_ComputerScreenshotImage"];
            
            status?: "in_progress" | "completed" | "incomplete";
            
            type: "computer_call_output";
        };
        Output_ComputerToolCallOutputResource: components["schemas"]["Output_ComputerToolCallOutput"] & {
            created_by?: string;
            id: string;
            status: components["schemas"]["Output_ComputerCallOutputStatus"];
        };
        
        Output_ComputerUsePreviewTool: {
            display_height: number;
            display_width: number;
            environment: components["schemas"]["Output_ComputerEnvironment"];
            
            type: "computer_use_preview";
        };
        Output_ContainerAutoParam: {
            file_ids?: string[];
            memory_limit?: components["schemas"]["Output_ContainerMemoryLimit"] | null;
            network_policy?: components["schemas"]["Output_ContainerNetworkPolicyDisabledParam"] | components["schemas"]["Output_ContainerNetworkPolicyAllowlistParam"];
            skills?: (components["schemas"]["Output_SkillReferenceParam"] | components["schemas"]["Output_InlineSkillParam"])[];
            
            type: "container_auto";
        };
        
        Output_ContainerFileCitationBody: {
            container_id: string;
            end_index: number;
            file_id: string;
            filename: string;
            start_index: number;
            
            type: "container_file_citation";
        };
        
        Output_ContainerMemoryLimit: "1g" | "4g" | "16g" | "64g";
        Output_ContainerNetworkPolicyAllowlistParam: {
            allowed_domains: string[];
            domain_secrets?: components["schemas"]["Output_ContainerNetworkPolicyDomainSecretParam"][];
            
            type: "allowlist";
        };
        Output_ContainerNetworkPolicyDisabledParam: {
            
            type: "disabled";
        };
        Output_ContainerNetworkPolicyDomainSecretParam: {
            domain: string;
            name: string;
            value: string;
        };
        Output_ContainerReferenceParam: {
            container_id: string;
            
            type: "container_reference";
        };
        
        Output_ContainerReferenceResource: {
            container_id: string;
            
            type: "container_reference";
        };
        
        Output_CoordParam: {
            x: number;
            y: number;
        };
        Output_CreateChatCompletionResponse: {
            choices: {
                
                finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | "no_content" | "error";
                index: number;
                logprobs?: {
                    content: components["schemas"]["Output_ChatCompletionTokenLogprob"][] | null;
                    refusal: components["schemas"]["Output_ChatCompletionTokenLogprob"][] | null;
                } | null;
                message: components["schemas"]["Output_ChatCompletionResponseMessage"];
                native_finish_reason?: string | null;
            }[];
            
            created: number;
            id: string;
            metadata?: components["schemas"]["Output_Metadata"];
            model: string;
            moderation?: components["schemas"]["Output_ChatCompletionModeration"] | null;
            
            object: "chat.completion";
            service_tier?: components["schemas"]["Output_ServiceTier"];
            
            system_fingerprint?: string | null;
            usage?: components["schemas"]["Output_CompletionUsage"];
        };
        Output_CreateChatCompletionStreamResponse: {
            choices: {
                delta: components["schemas"]["Output_ChatCompletionStreamResponseDelta"];
                
                finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null | "no_content" | "error";
                index: number;
                logprobs?: {
                    content: components["schemas"]["Output_ChatCompletionTokenLogprob"][] | null;
                    refusal: components["schemas"]["Output_ChatCompletionTokenLogprob"][] | null;
                } | null;
                native_finish_reason?: string | null;
            }[];
            
            created: number;
            id: string;
            model: string;
            moderation?: components["schemas"]["Output_ChatCompletionModeration"] | null;
            obfuscation?: string;
            
            object: "chat.completion.chunk";
            service_tier?: components["schemas"]["Output_ServiceTier"];
            
            system_fingerprint?: string | null;
            usage?: components["schemas"]["Output_CompletionUsage"] | null;
        };
        
        Output_CustomGrammarFormatParam: {
            definition: string;
            syntax: components["schemas"]["Output_GrammarSyntax1"];
            
            type: "grammar";
        };
        
        Output_CustomTextFormatParam: {
            
            type: "text";
        };
        
        Output_CustomToolCall: {
            async?: boolean;
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCaller"] | null;
            id?: string;
            input: string;
            name: string;
            namespace?: string;
            
            type: "custom_tool_call";
        };
        
        Output_CustomToolCallOutput: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            id?: string;
            output: string | components["schemas"]["Output_FunctionAndCustomToolCallOutput"][];
            
            type: "custom_tool_call_output";
        };
        
        Output_CustomToolCallOutputResource: components["schemas"]["Output_CustomToolCallOutput"] & {
            created_by?: string;
            id: string;
            status: components["schemas"]["Output_FunctionCallOutputStatusEnum"];
        };
        
        Output_CustomToolParam: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            async?: boolean;
            defer_loading?: boolean;
            format?: components["schemas"]["Output_CustomTextFormatParam"] | components["schemas"]["Output_CustomGrammarFormatParam"];
            name: string;
            
            type: "custom";
        };
        
        Output_CyberAccessProgramEnum: "standard" | "daybreak_blue" | "daybreak_red";
        
        Output_DetailEnum: "low" | "high" | "auto" | "original";
        Output_DirectToolCallCaller: {
            
            type: "direct";
        };
        Output_DirectToolCallCallerParam: {
            
            type: "direct";
        };
        
        Output_DoubleClickAction: {
            keys: string[] | null;
            
            type: "double_click";
            x: number;
            y: number;
        };
        
        Output_DragParam: {
            keys?: string[] | null;
            path: components["schemas"]["Output_CoordParam"][];
            
            type: "drag";
        };
        
        Output_EasyInputMessage: {
            content: string | components["schemas"]["Output_InputMessageContentList"];
            phase?: components["schemas"]["Output_MessagePhase"] | null;
            
            role: "user" | "assistant" | "system" | "developer";
            
            type?: "message";
        };
        Output_EmptyModelParam: Record<string, never>;
        
        Output_FileCitationBody: {
            file_id: string;
            filename: string;
            index: number;
            
            type: "file_citation";
        };
        
        Output_FileDetailEnum: "auto" | "low" | "high";
        
        Output_FileInputDetail: "auto" | "low" | "high";
        
        Output_FilePath: {
            file_id: string;
            index: number;
            
            type: "file_path";
        };
        
        Output_FileSearchTool: {
            filters?: components["schemas"]["Output_Filters"] | null;
            max_num_results?: number;
            ranking_options?: components["schemas"]["Output_RankingOptions"];
            
            type: "file_search";
            vector_store_ids: string[];
        };
        
        Output_FileSearchToolCall: {
            id: string;
            queries: string[];
            results?: {
                attributes?: components["schemas"]["Output_VectorStoreFileAttributes"];
                file_id?: string;
                filename?: string;
                
                score?: number;
                text?: string;
            }[] | null;
            
            status: "in_progress" | "searching" | "completed" | "incomplete" | "failed";
            
            type: "file_search_call";
        };
        Output_Filters: components["schemas"]["Output_ComparisonFilter"] | components["schemas"]["Output_CompoundFilter"];
        Output_FunctionAndCustomToolCallOutput: components["schemas"]["Output_InputTextContent"] | components["schemas"]["Output_InputImageContent"] | components["schemas"]["Output_InputFileContent"];
        
        Output_FunctionCallItemStatus: "in_progress" | "completed" | "incomplete";
        
        Output_FunctionCallOutputItemParam: {
            call_id?: string | null;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            id?: string | null;
            name?: string | null;
            namespace?: string | null;
            output: string | (components["schemas"]["Output_InputTextContentParam"] | components["schemas"]["Output_InputImageContentParamAutoParam"] | components["schemas"]["Output_InputFileContentParam"])[];
            status?: components["schemas"]["Output_FunctionCallItemStatus"] | null;
            
            type: "function_call_output";
        };
        
        Output_FunctionCallOutputStatusEnum: "in_progress" | "completed" | "incomplete";
        
        Output_FunctionCallStatus: "in_progress" | "completed" | "incomplete";
        
        Output_FunctionShellAction: {
            commands: string[];
            max_output_length: number | null;
            timeout_ms: number | null;
        };
        
        Output_FunctionShellActionParam: {
            commands: string[];
            max_output_length?: number | null;
            timeout_ms?: number | null;
        };
        
        Output_FunctionShellCall: {
            action: components["schemas"]["Output_FunctionShellAction"];
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCaller"] | null;
            created_by?: string;
            environment: (components["schemas"]["Output_LocalEnvironmentResource"] | components["schemas"]["Output_ContainerReferenceResource"]) | null;
            id: string;
            status: components["schemas"]["Output_FunctionShellCallStatus"];
            
            type: "shell_call";
        };
        
        Output_FunctionShellCallItemParam: {
            action: components["schemas"]["Output_FunctionShellActionParam"];
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            environment?: (components["schemas"]["Output_LocalEnvironmentParam"] | components["schemas"]["Output_ContainerReferenceParam"]) | null;
            id?: string | null;
            status?: components["schemas"]["Output_FunctionShellCallItemStatus"] | null;
            
            type: "shell_call";
        };
        
        Output_FunctionShellCallItemStatus: "in_progress" | "completed" | "incomplete";
        
        Output_FunctionShellCallOutput: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCaller"] | null;
            created_by?: string;
            id: string;
            max_output_length: number | null;
            output: components["schemas"]["Output_FunctionShellCallOutputContent"][];
            status: components["schemas"]["Output_FunctionShellCallOutputStatusEnum"];
            
            type: "shell_call_output";
        };
        
        Output_FunctionShellCallOutputContent: {
            created_by?: string;
            
            outcome: components["schemas"]["Output_FunctionShellCallOutputTimeoutOutcome"] | components["schemas"]["Output_FunctionShellCallOutputExitOutcome"];
            stderr: string;
            stdout: string;
        };
        
        Output_FunctionShellCallOutputContentParam: {
            outcome: components["schemas"]["Output_FunctionShellCallOutputOutcomeParam"];
            stderr: string;
            stdout: string;
        };
        
        Output_FunctionShellCallOutputExitOutcome: {
            exit_code: number;
            
            type: "exit";
        };
        
        Output_FunctionShellCallOutputExitOutcomeParam: {
            exit_code: number;
            
            type: "exit";
        };
        
        Output_FunctionShellCallOutputItemParam: {
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            id?: string | null;
            max_output_length?: number | null;
            output: components["schemas"]["Output_FunctionShellCallOutputContentParam"][];
            status?: components["schemas"]["Output_FunctionShellCallItemStatus"] | null;
            
            type: "shell_call_output";
        };
        
        Output_FunctionShellCallOutputOutcomeParam: components["schemas"]["Output_FunctionShellCallOutputTimeoutOutcomeParam"] | components["schemas"]["Output_FunctionShellCallOutputExitOutcomeParam"];
        
        Output_FunctionShellCallOutputStatusEnum: "in_progress" | "completed" | "incomplete";
        
        Output_FunctionShellCallOutputTimeoutOutcome: {
            
            type: "timeout";
        };
        
        Output_FunctionShellCallOutputTimeoutOutcomeParam: {
            
            type: "timeout";
        };
        
        Output_FunctionShellCallStatus: "in_progress" | "completed" | "incomplete";
        
        Output_FunctionShellToolParam: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            environment?: (components["schemas"]["Output_ContainerAutoParam"] | components["schemas"]["Output_LocalEnvironmentParam"] | components["schemas"]["Output_ContainerReferenceParam"]) | null;
            
            type: "shell";
        };
        
        Output_FunctionTool: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            async?: boolean;
            defer_loading?: boolean;
            name: string;
            output_schema?: {
                [key: string]: unknown;
            } | null;
            parameters: {
                [key: string]: unknown;
            } | null;
            strict: boolean | null;
            
            type: "function";
        };
        
        Output_FunctionToolCall: {
            arguments: string;
            async?: boolean;
            call_id: string;
            caller?: components["schemas"]["Output_ToolCallCaller"] | null;
            id?: string;
            name: string;
            namespace?: string;
            
            status?: "in_progress" | "completed" | "incomplete";
            
            type: "function_call";
        };
        
        Output_FunctionToolCallOutput: {
            call_id?: string;
            caller?: components["schemas"]["Output_ToolCallCallerParam"] | null;
            id?: string;
            name?: string;
            namespace?: string;
            output: string | components["schemas"]["Output_FunctionAndCustomToolCallOutput"][];
            
            status?: "in_progress" | "completed" | "incomplete";
            
            type: "function_call_output";
        };
        Output_FunctionToolCallOutputResource: components["schemas"]["Output_FunctionToolCallOutput"] & {
            created_by?: string;
            id: string;
            status: components["schemas"]["Output_FunctionCallOutputStatusEnum"];
        };
        Output_FunctionToolParam: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            async?: boolean;
            defer_loading?: boolean;
            name: string;
            output_schema?: {
                [key: string]: unknown;
            } | null;
            parameters?: components["schemas"]["Output_EmptyModelParam"] | null;
            strict?: boolean | null;
            
            type: "function";
        };
        
        Output_GrammarSyntax1: "lark" | "regex";
        Output_HTTPError: {
            code: number;
            message: string;
            
            type: "http_error";
        };
        Output_HybridSearchOptions: {
            embedding_weight: number;
            text_weight: number;
        };
        
        Output_ImageBackground: "transparent" | "opaque" | "auto";
        
        Output_ImageDetail: "low" | "high" | "auto" | "original";
        
        Output_ImageGenActionEnum: "generate" | "edit" | "auto";
        
        Output_ImageGenTool: {
            action?: components["schemas"]["Output_ImageGenActionEnum"];
            
            background?: "transparent" | "opaque" | "auto";
            input_fidelity?: components["schemas"]["Output_InputFidelity"] | null;
            input_image_mask?: {
                file_id?: string;
                image_url?: string;
            };
            model?: string;
            
            moderation?: "auto" | "low";
            
            output_compression?: number;
            
            output_format?: "png" | "webp" | "jpeg";
            
            partial_images?: number;
            
            quality?: "low" | "medium" | "high" | "xhigh" | "max" | "auto";
            
            size?: string | ("1024x1024" | "1024x1536" | "1536x1024" | "auto");
            
            type: "image_generation";
        };
        
        Output_ImageGenToolCall: {
            action?: components["schemas"]["Output_ImageGenActionEnum"] | null;
            background?: components["schemas"]["Output_ImageBackground"] | null;
            id: string;
            output_format?: components["schemas"]["Output_ImageOutputFormat"] | null;
            quality?: ("low" | "medium" | "high" | "xhigh" | "max" | "auto") | null;
            result: string | null;
            revised_prompt?: string | null;
            size?: (string | ("1024x1024" | "1024x1536" | "1536x1024")) | null;
            
            status: "in_progress" | "completed" | "generating" | "failed";
            
            type: "image_generation_call";
        };
        
        Output_ImageOutputFormat: "png" | "webp" | "jpeg";
        Output_InlineSkillParam: {
            name: string;
            source: components["schemas"]["Output_InlineSkillSourceParam"];
            
            type: "inline";
        };
        Output_InlineSkillSourceParam: {
            data: string;
            
            media_type: "application/zip";
            
            type: "base64";
        };
        Output_InputContent: components["schemas"]["Output_InputTextContent"] | components["schemas"]["Output_InputImageContent"] | components["schemas"]["Output_InputFileContent"];
        
        Output_InputFidelity: "high" | "low";
        
        Output_InputFileContent: {
            detail?: components["schemas"]["Output_FileInputDetail"];
            file_data?: string;
            file_id?: string | null;
            
            file_url?: string;
            filename?: string;
            prompt_cache_breakpoint?: components["schemas"]["Output_PromptCacheBreakpointConfig"];
            
            type: "input_file";
        };
        
        Output_InputFileContentParam: {
            detail?: components["schemas"]["Output_FileDetailEnum"];
            file_data?: string | null;
            file_id?: string | null;
            file_url?: string | null;
            filename?: string | null;
            prompt_cache_breakpoint?: components["schemas"]["Output_PromptCacheBreakpointParam"] | null;
            
            type: "input_file";
        };
        
        Output_InputImageContent: {
            detail: components["schemas"]["Output_ImageDetail"];
            file_id?: string | null;
            image_url?: string | null;
            prompt_cache_breakpoint?: components["schemas"]["Output_PromptCacheBreakpointConfig"];
            
            type: "input_image";
        };
        
        Output_InputImageContentParamAutoParam: {
            detail?: components["schemas"]["Output_DetailEnum"] | null;
            file_id?: string | null;
            image_url?: string | null;
            prompt_cache_breakpoint?: components["schemas"]["Output_PromptCacheBreakpointParam"] | null;
            
            type: "input_image";
        };
        Output_InputItem: components["schemas"]["Output_EasyInputMessage"] | components["schemas"]["Output_Item"] | components["schemas"]["Output_CompactionTriggerItemParam"] | components["schemas"]["Output_ItemReferenceParam"] | components["schemas"]["Output_ProgramItemParam"] | components["schemas"]["Output_ProgramOutputItemParam"];
        
        Output_InputMessage: {
            content: components["schemas"]["Output_InputMessageContentList"];
            
            role: "user" | "system" | "developer";
            
            status?: "in_progress" | "completed" | "incomplete";
            
            type?: "message";
        };
        
        Output_InputMessageContentList: components["schemas"]["Output_InputContent"][];
        
        Output_InputTextContent: {
            prompt_cache_breakpoint?: components["schemas"]["Output_PromptCacheBreakpointConfig"];
            text: string;
            
            type: "input_text";
        };
        
        Output_InputTextContentParam: {
            prompt_cache_breakpoint?: components["schemas"]["Output_PromptCacheBreakpointParam"] | null;
            text: string;
            
            type: "input_text";
        };
        Output_Item: components["schemas"]["Output_InputMessage"] | components["schemas"]["Output_OutputMessage"] | components["schemas"]["Output_FileSearchToolCall"] | components["schemas"]["Output_ComputerToolCall"] | components["schemas"]["Output_ComputerCallOutputItemParam"] | components["schemas"]["Output_WebSearchToolCall"] | components["schemas"]["Output_FunctionToolCall"] | components["schemas"]["Output_FunctionCallOutputItemParam"] | components["schemas"]["Output_ToolSearchCallItemParam"] | components["schemas"]["Output_ToolSearchOutputItemParam"] | components["schemas"]["Output_AdditionalToolsItemParam"] | components["schemas"]["Output_ResponseConfigurationUpdateItemParam"] | components["schemas"]["Output_ReasoningItem"] | components["schemas"]["Output_CompactionSummaryItemParam"] | components["schemas"]["Output_ImageGenToolCall"] | components["schemas"]["Output_CodeInterpreterToolCall"] | components["schemas"]["Output_LocalShellToolCall"] | components["schemas"]["Output_LocalShellToolCallOutput"] | components["schemas"]["Output_FunctionShellCallItemParam"] | components["schemas"]["Output_FunctionShellCallOutputItemParam"] | components["schemas"]["Output_ApplyPatchToolCallItemParam"] | components["schemas"]["Output_ApplyPatchToolCallOutputItemParam"] | components["schemas"]["Output_MCPListTools"] | components["schemas"]["Output_MCPApprovalRequest"] | components["schemas"]["Output_MCPApprovalResponse"] | components["schemas"]["Output_MCPToolCall"] | components["schemas"]["Output_CustomToolCallOutput"] | components["schemas"]["Output_CustomToolCall"];
        
        Output_ItemReferenceParam: {
            id: string;
            type?: "item_reference" | null;
        };
        
        Output_KeyPressAction: {
            keys: string[];
            
            type: "keypress";
        };
        Output_LocalEnvironmentParam: {
            skills?: components["schemas"]["Output_LocalSkillParam"][];
            
            type: "local";
        };
        
        Output_LocalEnvironmentResource: {
            
            type: "local";
        };
        
        Output_LocalShellExecAction: {
            command: string[];
            env: {
                [key: string]: string;
            };
            timeout_ms?: number | null;
            
            type: "exec";
            user?: string | null;
            working_directory?: string | null;
        };
        
        Output_LocalShellToolCall: {
            action: components["schemas"]["Output_LocalShellExecAction"];
            call_id: string;
            id: string;
            
            status: "in_progress" | "completed" | "incomplete";
            
            type: "local_shell_call";
        };
        
        Output_LocalShellToolCallOutput: {
            id: string;
            output: string;
            status?: ("in_progress" | "completed" | "incomplete") | null;
            
            type: "local_shell_call_output";
        };
        
        Output_LocalShellToolParam: {
            
            type: "local_shell";
        };
        Output_LocalSkillParam: {
            name: string;
            path: string;
        };
        
        Output_LogProb: {
            bytes: number[];
            logprob: number;
            token: string;
            top_logprobs: components["schemas"]["Output_TopLogProb"][];
        };
        
        Output_MCPApprovalRequest: {
            arguments: string;
            id: string;
            name: string;
            server_label: string;
            
            type: "mcp_approval_request";
        };
        
        Output_MCPApprovalResponse: {
            approval_request_id: string;
            approve: boolean;
            id?: string | null;
            reason?: string | null;
            
            type: "mcp_approval_response";
        };
        
        Output_MCPApprovalResponseResource: {
            approval_request_id: string;
            approve: boolean;
            id: string;
            reason?: string | null;
            
            type: "mcp_approval_response";
        };
        
        Output_MCPListTools: {
            error?: string | null;
            id: string;
            server_label: string;
            tools: components["schemas"]["Output_MCPListToolsTool"][];
            
            type: "mcp_list_tools";
        };
        
        Output_MCPListToolsTool: {
            annotations?: Record<string, never> | null;
            input_schema: Record<string, never>;
            name: string;
        };
        Output_MCPProtocolError: {
            code: number;
            message: string;
            
            type: "mcp_protocol_error";
        };
        
        Output_MCPTool: {
            allowed_callers?: components["schemas"]["Output_CallableToolAllowedCaller"][] | null;
            allowed_tools?: (string[] | components["schemas"]["Output_MCPToolFilter"]) | null;
            authorization?: string;
            
            connector_id?: "connector_dropbox" | "connector_gmail" | "connector_googlecalendar" | "connector_googledrive" | "connector_microsoftteams" | "connector_outlookcalendar" | "connector_outlookemail" | "connector_sharepoint";
            defer_loading?: boolean;
            headers?: {
                [key: string]: string;
            } | null;
            require_approval?: ({
                always?: components["schemas"]["Output_MCPToolFilter"];
                never?: components["schemas"]["Output_MCPToolFilter"];
            } | ("always" | "never")) | null;
            server_description?: string;
            server_label: string;
            
            server_url?: string;
            tunnel_id?: string;
            
            type: "mcp";
        };
        
        Output_MCPToolCall: {
            approval_request_id?: string | null;
            arguments: string;
            error?: components["schemas"]["Output_MCPToolCallError"] | null;
            id: string;
            name: string;
            output?: string | null;
            server_label: string;
            status?: components["schemas"]["Output_MCPToolCallStatus"];
            
            type: "mcp_call";
        };
        Output_MCPToolCallError: components["schemas"]["Output_MCPProtocolError"] | components["schemas"]["Output_MCPToolExecutionError"] | components["schemas"]["Output_HTTPError"];
        
        Output_MCPToolCallStatus: "in_progress" | "completed" | "incomplete" | "calling" | "failed";
        Output_MCPToolExecutionError: {
            content: unknown;
            
            type: "mcp_tool_execution_error";
        };
        
        Output_MCPToolFilter: {
            read_only?: boolean;
            
            tool_names?: string[];
        };
        
        Output_MessagePhase: "commentary" | "final_answer";
        
        Output_MessageRole: "unknown" | "user" | "assistant" | "system" | "critic" | "discriminator" | "developer" | "tool";
        Output_Metadata: {
            [key: string]: string;
        } | null;
        Output_MisalignmentErrorDetailsResource: {
            detailed_explanation?: string;
            error_type?: components["schemas"]["Output__MisalignmentErrorType"];
            steer?: components["schemas"]["Output__MisalignmentSteer"];
        };
        Output_ModelResponseProperties: {
            metadata?: components["schemas"]["Output_Metadata"];
            prompt_cache_key?: string | null;
            
            prompt_cache_retention?: ("in_memory" | "24h") | null;
            safety_identifier?: string | null;
            temperature?: number | null;
            top_logprobs?: number | null;
            top_p?: number | null;
            
            user?: string | null;
        };
        
        Output_Moderation: {
            input: components["schemas"]["Output_ModerationResultBody"] | components["schemas"]["Output_ModerationErrorBody"];
            output: components["schemas"]["Output_ModerationResultBody"] | components["schemas"]["Output_ModerationErrorBody"];
        };
        
        Output_ModerationErrorBody: {
            code: string;
            message: string;
            
            type: "error";
        };
        
        Output_ModerationInputType: "text" | "image";
        
        Output_ModerationResultBody: {
            categories: {
                [key: string]: boolean;
            };
            category_applied_input_types: {
                [key: string]: components["schemas"]["Output_ModerationInputType"][];
            };
            category_scores: {
                [key: string]: number;
            };
            flagged: boolean;
            model: string;
            
            type: "moderation_result";
        };
        
        Output_MoveParam: {
            keys?: string[] | null;
            
            type: "move";
            x: number;
            y: number;
        };
        
        Output_NamespaceToolParam: {
            name: string;
            tools: (components["schemas"]["Output_FunctionToolParam"] | components["schemas"]["Output_CustomToolParam"])[];
            
            type: "namespace";
        };
        Output_OutputContent: components["schemas"]["Output_OutputTextContent"] | components["schemas"]["Output_RefusalContent"] | components["schemas"]["Output_ReasoningTextContent"];
        Output_OutputItem: components["schemas"]["Output_OutputMessage"] | components["schemas"]["Output_FileSearchToolCall"] | components["schemas"]["Output_FunctionToolCall"] | components["schemas"]["Output_FunctionToolCallOutputResource"] | components["schemas"]["Output_WebSearchToolCall"] | components["schemas"]["Output_ComputerToolCall"] | components["schemas"]["Output_ComputerToolCallOutputResource"] | components["schemas"]["Output_ReasoningItem"] | components["schemas"]["Output_Program"] | components["schemas"]["Output_ProgramOutput"] | components["schemas"]["Output_ToolSearchCall"] | components["schemas"]["Output_ToolSearchOutput"] | components["schemas"]["Output_AdditionalTools"] | components["schemas"]["Output_CompactionBody"] | components["schemas"]["Output_ImageGenToolCall"] | components["schemas"]["Output_CodeInterpreterToolCall"] | components["schemas"]["Output_LocalShellToolCall"] | components["schemas"]["Output_LocalShellToolCallOutput"] | components["schemas"]["Output_FunctionShellCall"] | components["schemas"]["Output_FunctionShellCallOutput"] | components["schemas"]["Output_ApplyPatchToolCall"] | components["schemas"]["Output_ApplyPatchToolCallOutput"] | components["schemas"]["Output_MCPToolCall"] | components["schemas"]["Output_MCPListTools"] | components["schemas"]["Output_MCPApprovalRequest"] | components["schemas"]["Output_MCPApprovalResponseResource"] | components["schemas"]["Output_CustomToolCall"] | components["schemas"]["Output_CustomToolCallOutputResource"];
        
        Output_OutputMessage: {
            content: components["schemas"]["Output_OutputMessageContent"][];
            id: string;
            phase?: components["schemas"]["Output_MessagePhase"] | null;
            
            role: "assistant";
            
            status: "in_progress" | "completed" | "incomplete";
            
            type: "message";
        };
        Output_OutputMessageContent: components["schemas"]["Output_OutputTextContent"] | components["schemas"]["Output_RefusalContent"];
        
        Output_OutputTextContent: {
            annotations: components["schemas"]["Output_Annotation"][];
            logprobs: components["schemas"]["Output_LogProb"][];
            text: string;
            
            type: "output_text";
        };
        Output_Program: {
            call_id: string;
            code: string;
            fingerprint: string;
            id: string;
            
            type: "program";
        };
        Output_ProgramItemParam: {
            call_id: string;
            code: string;
            fingerprint: string;
            id: string;
            
            type: "program";
        };
        Output_ProgrammaticToolCallingParam: {
            
            type: "programmatic_tool_calling";
        };
        Output_ProgramOutput: {
            call_id: string;
            id: string;
            result: string;
            status: components["schemas"]["Output_ProgramOutputStatus"];
            
            type: "program_output";
        };
        Output_ProgramOutputItemParam: {
            call_id: string;
            id: string;
            result: string;
            status: components["schemas"]["Output_ProgramOutputItemStatus"];
            
            type: "program_output";
        };
        
        Output_ProgramOutputItemStatus: "completed" | "incomplete";
        
        Output_ProgramOutputStatus: "completed" | "incomplete";
        Output_ProgramToolCallCaller: {
            caller_id: string;
            
            type: "program";
        };
        Output_ProgramToolCallCallerParam: {
            caller_id: string;
            
            type: "program";
        };
        Output_Prompt: {
            id: string;
            variables?: components["schemas"]["Output_ResponsePromptVariables"];
            version?: string | null;
        } | null;
        
        Output_PromptCacheBreakpointConfig: {
            
            mode: "explicit";
            ttl?: components["schemas"]["Output_PromptCacheTTLEnum"];
        };
        
        Output_PromptCacheBreakpointParam: {
            
            mode: "explicit";
            ttl?: components["schemas"]["Output_PromptCacheTTLEnum"];
        };
        Output_PromptCacheComparisonResponseNotFoundDiagnosticsBody: {
            
            type: "comparison_response_not_found";
        };
        Output_PromptCacheDiagnostics: components["schemas"]["Output_PromptCacheMissDiagnosticsBody"] | components["schemas"]["Output_PromptCacheHitDiagnosticsBody"] | components["schemas"]["Output_PromptCacheComparisonResponseNotFoundDiagnosticsBody"] | components["schemas"]["Output_PromptCacheUnavailableDiagnosticsBody"];
        Output_PromptCacheHitDiagnosticsBody: {
            
            type: "cache_hit";
        };
        Output_PromptCacheMissDiagnosticsBody: {
            cache_missed_tokens: number;
            comparison_reusable_tokens?: number;
            reason: components["schemas"]["Output_CacheMissReasonTypeEnum"];
            
            type: "cache_miss";
        };
        
        Output_PromptCacheModeEnum: "implicit" | "explicit";
        
        Output_PromptCacheOptions: {
            comparison_response_id?: string | null;
            mode: components["schemas"]["Output_PromptCacheModeEnum"];
            ttl: components["schemas"]["Output_PromptCacheTTLEnum"];
        };
        
        Output_PromptCacheTTLEnum: "30m" | "12h";
        Output_PromptCacheUnavailableDiagnosticsBody: {
            
            type: "unavailable";
        };
        
        Output_RankerVersionType: "auto" | "default-2024-11-15";
        Output_RankingOptions: {
            hybrid_search?: components["schemas"]["Output_HybridSearchOptions"];
            ranker?: components["schemas"]["Output_RankerVersionType"];
            score_threshold?: number;
        };
        
        Output_Reasoning: {
            context?: ("auto" | "current_turn" | "all_turns") | null;
            effort?: components["schemas"]["Output_ReasoningEffort"];
            generate_summary?: ("auto" | "concise" | "detailed") | null;
            mode?: components["schemas"]["Output_ReasoningModeEnum"];
            summary?: ("auto" | "concise" | "detailed") | null;
        };
        Output_ReasoningEffort: ("none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max") | null;
        
        Output_ReasoningItem: {
            content?: components["schemas"]["Output_ReasoningTextContent"][];
            encrypted_content?: string | null;
            id: string;
            
            status?: "in_progress" | "completed" | "incomplete";
            summary: components["schemas"]["Output_SummaryTextContent"][];
            
            type: "reasoning";
        };
        Output_ReasoningModeEnum: string | ("standard" | "pro");
        
        Output_ReasoningTextContent: {
            text: string;
            
            type: "reasoning_text";
        };
        
        Output_RefusalContent: {
            refusal: string;
            
            type: "refusal";
        };
        
        Output_Response: components["schemas"]["Output_ModelResponseProperties"] & components["schemas"]["Output_ResponseProperties"] & {
            access_programs: components["schemas"]["Output_AccessProgramsBody"] | null;
            completed_at?: number | null;
            conversation?: components["schemas"]["Output_ResponseConversation"] | null;
            
            created_at: number;
            error: components["schemas"]["Output_ResponseError"];
            id: string;
            incomplete_details: {
                
                reason?: "max_output_tokens" | "max_messages" | "content_filter" | "steered";
            } | null;
            instructions: (string | components["schemas"]["Output_InputItem"][]) | null;
            max_output_tokens?: number | null;
            moderation?: components["schemas"]["Output_Moderation"] | null;
            
            object: "response";
            output: components["schemas"]["Output_OutputItem"][];
            
            parallel_tool_calls: boolean;
            prompt_cache_diagnostics?: components["schemas"]["Output_PromptCacheDiagnostics"];
            prompt_cache_options?: components["schemas"]["Output_PromptCacheOptions"];
            reasoning?: components["schemas"]["Output_Reasoning"] | null;
            service_tier?: components["schemas"]["Output_ServiceTierResponses"];
            
            status?: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete";
            truncation?: ("auto" | "disabled") | null;
            usage?: components["schemas"]["Output_ResponseUsage"] | null;
        };
        Output_ResponseAudioDeltaEvent: {
            delta: string;
            sequence_number: number;
            
            type: "response.audio.delta";
        };
        Output_ResponseAudioDoneEvent: {
            sequence_number: number;
            
            type: "response.audio.done";
        };
        Output_ResponseAudioTranscriptDeltaEvent: {
            delta: string;
            sequence_number: number;
            
            type: "response.audio.transcript.delta";
        };
        Output_ResponseAudioTranscriptDoneEvent: {
            sequence_number: number;
            
            type: "response.audio.transcript.done";
        };
        Output_ResponseCodeInterpreterCallCodeDeltaEvent: {
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.code_interpreter_call_code.delta";
        };
        Output_ResponseCodeInterpreterCallCodeDoneEvent: {
            code: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.code_interpreter_call_code.done";
        };
        Output_ResponseCodeInterpreterCallCompletedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.code_interpreter_call.completed";
        };
        Output_ResponseCodeInterpreterCallInProgressEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.code_interpreter_call.in_progress";
        };
        Output_ResponseCodeInterpreterCallInterpretingEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.code_interpreter_call.interpreting";
        };
        
        Output_ResponseCompactionCompactingStreamingEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.compaction.compacting";
        };
        Output_ResponseCompletedEvent: {
            response: components["schemas"]["Output_Response"];
            sequence_number: number;
            
            type: "response.completed";
        };
        Output_ResponseConfigurationUpdateItemParam: {
            id?: string | null;
            reasoning?: {
                effort?: components["schemas"]["Output_ReasoningEffort"];
            };
            
            type: "configuration_update";
        };
        Output_ResponseContentPartAddedEvent: {
            content_index: number;
            item_id: string;
            output_index: number;
            part: components["schemas"]["Output_OutputContent"];
            sequence_number: number;
            
            type: "response.content_part.added";
        };
        Output_ResponseContentPartDoneEvent: {
            content_index: number;
            item_id: string;
            output_index: number;
            part: components["schemas"]["Output_OutputContent"];
            sequence_number: number;
            
            type: "response.content_part.done";
        };
        
        Output_ResponseConversation: {
            id: string;
        };
        Output_ResponseCreatedEvent: {
            response: components["schemas"]["Output_Response"];
            sequence_number: number;
            
            type: "response.created";
        };
        
        Output_ResponseCustomToolCallInputDeltaEvent: {
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.custom_tool_call_input.delta";
        };
        
        Output_ResponseCustomToolCallInputDoneEvent: {
            input: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.custom_tool_call_input.done";
        };
        Output_ResponseError: {
            code: components["schemas"]["Output_ResponseErrorCode"];
            message: string;
            misalignment?: components["schemas"]["Output_MisalignmentErrorDetailsResource"];
        } | null;
        
        Output_ResponseErrorCode: "server_error" | "rate_limit_exceeded" | "invalid_prompt" | "data_residency_mismatch" | "bio_policy" | "misalignment_policy_violation" | "vector_store_timeout" | "invalid_image" | "invalid_image_format" | "invalid_base64_image" | "invalid_image_url" | "image_too_large" | "image_too_small" | "image_parse_error" | "image_content_policy_violation" | "invalid_image_mode" | "image_file_too_large" | "unsupported_image_media_type" | "empty_image_file" | "failed_to_download_image" | "image_file_not_found";
        Output_ResponseErrorEvent: {
            code: string | null;
            message: string;
            param: string | null;
            sequence_number: number;
            
            type: "error";
        } | {
            error: {
                code: string | null;
                message: string;
                param: string | null;
                type: string;
            };
            sequence_number: number;
            
            type: "error";
        };
        Output_ResponseFailedEvent: {
            response: components["schemas"]["Output_Response"];
            sequence_number: number;
            
            type: "response.failed";
        };
        Output_ResponseFileSearchCallCompletedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.file_search_call.completed";
        };
        Output_ResponseFileSearchCallInProgressEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.file_search_call.in_progress";
        };
        Output_ResponseFileSearchCallSearchingEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.file_search_call.searching";
        };
        
        Output_ResponseFormatJsonObject: {
            
            type: "json_object";
        };
        
        Output_ResponseFormatJsonSchemaSchema: {
            [key: string]: unknown;
        };
        
        Output_ResponseFormatText: {
            
            type: "text";
        };
        Output_ResponseFunctionCallArgumentsDeltaEvent: {
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.function_call_arguments.delta";
        };
        Output_ResponseFunctionCallArgumentsDoneEvent: {
            arguments: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.function_call_arguments.done";
        };
        
        Output_ResponseImageGenCallCompletedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.image_generation_call.completed";
        };
        
        Output_ResponseImageGenCallGeneratingEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.image_generation_call.generating";
        };
        
        Output_ResponseImageGenCallInProgressEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.image_generation_call.in_progress";
        };
        
        Output_ResponseImageGenCallPartialImageEvent: {
            background?: string;
            item_id: string;
            output_format?: string;
            output_index: number;
            partial_image_b64: string;
            partial_image_index: number;
            quality?: string;
            sequence_number: number;
            size?: string;
            
            type: "response.image_generation_call.partial_image";
        };
        Output_ResponseIncompleteEvent: {
            response: components["schemas"]["Output_Response"];
            sequence_number: number;
            
            type: "response.incomplete";
        };
        Output_ResponseInProgressEvent: {
            response: components["schemas"]["Output_Response"];
            sequence_number: number;
            
            type: "response.in_progress";
        };
        Output_ResponseLogProb: {
            logprob: number;
            token: string;
            top_logprobs?: {
                logprob?: number;
                token?: string;
            }[];
        };
        
        Output_ResponseMCPCallArgumentsDeltaEvent: {
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_call_arguments.delta";
        };
        
        Output_ResponseMCPCallArgumentsDoneEvent: {
            arguments: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_call_arguments.done";
        };
        
        Output_ResponseMCPCallCompletedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_call.completed";
        };
        
        Output_ResponseMCPCallFailedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_call.failed";
        };
        
        Output_ResponseMCPCallInProgressEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_call.in_progress";
        };
        
        Output_ResponseMCPListToolsCompletedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_list_tools.completed";
        };
        
        Output_ResponseMCPListToolsFailedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_list_tools.failed";
        };
        
        Output_ResponseMCPListToolsInProgressEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.mcp_list_tools.in_progress";
        };
        Output_ResponseOutputItemAddedEvent: {
            item: components["schemas"]["Output_OutputItem"];
            output_index: number;
            sequence_number: number;
            
            type: "response.output_item.added";
        };
        Output_ResponseOutputItemDoneEvent: {
            item: components["schemas"]["Output_OutputItem"];
            output_index: number;
            sequence_number: number;
            
            type: "response.output_item.done";
        };
        
        Output_ResponseOutputTextAnnotationAddedEvent: {
            annotation: components["schemas"]["Output_Annotation"] | null;
            annotation_index: number;
            content_index: number;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.output_text.annotation.added";
        };
        Output_ResponsePromptVariables: {
            [key: string]: string | components["schemas"]["Output_InputTextContent"] | components["schemas"]["Output_InputImageContent"] | components["schemas"]["Output_InputFileContent"];
        } | null;
        Output_ResponseProperties: {
            background?: boolean | null;
            max_tool_calls?: number | null;
            model?: string;
            previous_response_id?: string | null;
            prompt?: components["schemas"]["Output_Prompt"];
            text?: components["schemas"]["Output_ResponseTextParam"];
            tool_choice?: components["schemas"]["Output_ToolChoiceParam"];
            tools?: components["schemas"]["Output_ToolsArray"];
        };
        
        Output_ResponseQueuedEvent: {
            response: components["schemas"]["Output_Response"];
            sequence_number: number;
            
            type: "response.queued";
        };
        Output_ResponseReasoningSummaryPartAddedEvent: {
            item_id: string;
            output_index: number;
            part: {
                text: string;
                
                type: "summary_text";
            };
            sequence_number: number;
            summary_index: number;
            
            type: "response.reasoning_summary_part.added";
        };
        Output_ResponseReasoningSummaryPartDoneEvent: {
            item_id: string;
            output_index: number;
            part: {
                text: string;
                
                type: "summary_text";
            };
            sequence_number: number;
            
            status?: "incomplete";
            summary_index: number;
            
            type: "response.reasoning_summary_part.done";
        };
        Output_ResponseReasoningSummaryTextDeltaEvent: {
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            summary_index: number;
            
            type: "response.reasoning_summary_text.delta";
        };
        Output_ResponseReasoningSummaryTextDoneEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            summary_index: number;
            text: string;
            
            type: "response.reasoning_summary_text.done";
        };
        Output_ResponseReasoningTextDeltaEvent: {
            content_index: number;
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.reasoning_text.delta";
        };
        Output_ResponseReasoningTextDoneEvent: {
            content_index: number;
            item_id: string;
            output_index: number;
            sequence_number: number;
            text: string;
            
            type: "response.reasoning_text.done";
        };
        Output_ResponseRefusalDeltaEvent: {
            content_index: number;
            delta: string;
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.refusal.delta";
        };
        Output_ResponseRefusalDoneEvent: {
            content_index: number;
            item_id: string;
            output_index: number;
            refusal: string;
            sequence_number: number;
            
            type: "response.refusal.done";
        };
        
        Output_ResponseShellCallCommandAddedStreamingEvent: {
            command: string;
            command_index: number;
            output_index: number;
            sequence_number: number;
            
            type: "response.shell_call_command.added";
        };
        
        Output_ResponseShellCallCommandDeltaStreamingEvent: {
            command_index: number;
            delta: string;
            obfuscation?: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.shell_call_command.delta";
        };
        
        Output_ResponseShellCallCommandDoneStreamingEvent: {
            command: string;
            command_index: number;
            output_index: number;
            sequence_number: number;
            
            type: "response.shell_call_command.done";
        };
        
        Output_ResponseShellCallOutputContentDeltaStreamingEvent: {
            command_index: number;
            delta: components["schemas"]["Output_ShellCallOutputDelta"];
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.shell_call_output_content.delta";
        };
        
        Output_ResponseShellCallOutputContentDoneStreamingEvent: {
            command_index: number;
            item_id: string;
            output: components["schemas"]["Output_FunctionShellCallOutputContent"][];
            output_index: number;
            sequence_number: number;
            
            type: "response.shell_call_output_content.done";
        };
        Output_ResponseStreamEvent: components["schemas"]["Output_ResponseAudioDeltaEvent"] | components["schemas"]["Output_ResponseAudioDoneEvent"] | components["schemas"]["Output_ResponseAudioTranscriptDeltaEvent"] | components["schemas"]["Output_ResponseAudioTranscriptDoneEvent"] | components["schemas"]["Output_ResponseCodeInterpreterCallCodeDeltaEvent"] | components["schemas"]["Output_ResponseCodeInterpreterCallCodeDoneEvent"] | components["schemas"]["Output_ResponseCodeInterpreterCallCompletedEvent"] | components["schemas"]["Output_ResponseCodeInterpreterCallInProgressEvent"] | components["schemas"]["Output_ResponseCodeInterpreterCallInterpretingEvent"] | components["schemas"]["Output_ResponseCompactionCompactingStreamingEvent"] | components["schemas"]["Output_ResponseCompletedEvent"] | components["schemas"]["Output_ResponseContentPartAddedEvent"] | components["schemas"]["Output_ResponseContentPartDoneEvent"] | components["schemas"]["Output_ResponseCreatedEvent"] | components["schemas"]["Output_ResponseErrorEvent"] | components["schemas"]["Output_ResponseFileSearchCallCompletedEvent"] | components["schemas"]["Output_ResponseFileSearchCallInProgressEvent"] | components["schemas"]["Output_ResponseFileSearchCallSearchingEvent"] | components["schemas"]["Output_ResponseFunctionCallArgumentsDeltaEvent"] | components["schemas"]["Output_ResponseFunctionCallArgumentsDoneEvent"] | components["schemas"]["Output_ResponseShellCallCommandAddedStreamingEvent"] | components["schemas"]["Output_ResponseShellCallCommandDeltaStreamingEvent"] | components["schemas"]["Output_ResponseShellCallCommandDoneStreamingEvent"] | components["schemas"]["Output_ResponseShellCallOutputContentDeltaStreamingEvent"] | components["schemas"]["Output_ResponseShellCallOutputContentDoneStreamingEvent"] | components["schemas"]["Output_ResponseInProgressEvent"] | components["schemas"]["Output_ResponseFailedEvent"] | components["schemas"]["Output_ResponseIncompleteEvent"] | components["schemas"]["Output_ResponseOutputItemAddedEvent"] | components["schemas"]["Output_ResponseOutputItemDoneEvent"] | components["schemas"]["Output_ResponseReasoningSummaryPartAddedEvent"] | components["schemas"]["Output_ResponseReasoningSummaryPartDoneEvent"] | components["schemas"]["Output_ResponseReasoningSummaryTextDeltaEvent"] | components["schemas"]["Output_ResponseReasoningSummaryTextDoneEvent"] | components["schemas"]["Output_ResponseReasoningTextDeltaEvent"] | components["schemas"]["Output_ResponseReasoningTextDoneEvent"] | components["schemas"]["Output_ResponseRefusalDeltaEvent"] | components["schemas"]["Output_ResponseRefusalDoneEvent"] | components["schemas"]["Output_ResponseTextDeltaEvent"] | components["schemas"]["Output_ResponseTextDoneEvent"] | components["schemas"]["Output_ResponseWebSearchCallCompletedEvent"] | components["schemas"]["Output_ResponseWebSearchCallInProgressEvent"] | components["schemas"]["Output_ResponseWebSearchCallSearchingEvent"] | components["schemas"]["Output_ResponseImageGenCallCompletedEvent"] | components["schemas"]["Output_ResponseImageGenCallGeneratingEvent"] | components["schemas"]["Output_ResponseImageGenCallInProgressEvent"] | components["schemas"]["Output_ResponseImageGenCallPartialImageEvent"] | components["schemas"]["Output_ResponseMCPCallArgumentsDeltaEvent"] | components["schemas"]["Output_ResponseMCPCallArgumentsDoneEvent"] | components["schemas"]["Output_ResponseMCPCallCompletedEvent"] | components["schemas"]["Output_ResponseMCPCallFailedEvent"] | components["schemas"]["Output_ResponseMCPCallInProgressEvent"] | components["schemas"]["Output_ResponseMCPListToolsCompletedEvent"] | components["schemas"]["Output_ResponseMCPListToolsFailedEvent"] | components["schemas"]["Output_ResponseMCPListToolsInProgressEvent"] | components["schemas"]["Output_ResponseOutputTextAnnotationAddedEvent"] | components["schemas"]["Output_ResponseQueuedEvent"] | components["schemas"]["Output_ResponseCustomToolCallInputDeltaEvent"] | components["schemas"]["Output_ResponseCustomToolCallInputDoneEvent"];
        Output_ResponseTextDeltaEvent: {
            content_index: number;
            delta: string;
            item_id: string;
            logprobs: components["schemas"]["Output_ResponseLogProb"][];
            output_index: number;
            sequence_number: number;
            
            type: "response.output_text.delta";
        };
        Output_ResponseTextDoneEvent: {
            content_index: number;
            item_id: string;
            logprobs: components["schemas"]["Output_ResponseLogProb"][];
            output_index: number;
            sequence_number: number;
            text: string;
            
            type: "response.output_text.done";
        };
        Output_ResponseTextParam: {
            format?: components["schemas"]["Output_TextResponseFormatConfiguration"];
            verbosity?: components["schemas"]["Output_Verbosity"];
        };
        Output_ResponseUsage: {
            input_tokens: number;
            input_tokens_details: {
                cache_write_tokens: number;
                cache_write_tokens_details?: {
                    ttl_12h_tokens: number;
                    ttl_30m_tokens: number;
                };
                cached_tokens: number;
            };
            output_tokens: number;
            output_tokens_details: {
                reasoning_tokens: number;
            };
            total_tokens: number;
        };
        Output_ResponseWebSearchCallCompletedEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.web_search_call.completed";
        };
        Output_ResponseWebSearchCallInProgressEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.web_search_call.in_progress";
        };
        Output_ResponseWebSearchCallSearchingEvent: {
            item_id: string;
            output_index: number;
            sequence_number: number;
            
            type: "response.web_search_call.searching";
        };
        
        Output_ScreenshotParam: {
            
            type: "screenshot";
        };
        
        Output_ScrollParam: {
            keys?: string[] | null;
            scroll_x: number;
            scroll_y: number;
            
            type: "scroll";
            x: number;
            y: number;
        };
        
        Output_SearchContentType: "text" | "image";
        
        Output_SearchContextSize: "low" | "medium" | "high";
        Output_ServiceTier: ("auto" | "default" | "flex" | "scale" | "priority" | "fast") | null;
        Output_ServiceTierResponses: ("auto" | "default" | "flex" | "scale" | "priority" | "fast" | "ultrafast") | null;
        
        Output_ShellCallOutputDelta: {
            stderr?: string;
            stdout?: string;
        };
        Output_SkillReferenceParam: {
            skill_id: string;
            
            type: "skill_reference";
            version?: string;
        };
        
        Output_SpecificApplyPatchParam: {
            
            type: "apply_patch";
        };
        
        Output_SpecificFunctionShellParam: {
            
            type: "shell";
        };
        Output_SpecificProgrammaticToolCallingParam: {
            
            type: "programmatic_tool_calling";
        };
        
        Output_SummaryTextContent: {
            text: string;
            
            type: "summary_text";
        };
        Output_TextResponseFormatConfiguration: components["schemas"]["Output_ResponseFormatText"] | components["schemas"]["Output_TextResponseFormatJsonSchema"] | components["schemas"]["Output_ResponseFormatJsonObject"];
        
        Output_TextResponseFormatJsonSchema: {
            name: string;
            schema: components["schemas"]["Output_ResponseFormatJsonSchemaSchema"];
            strict?: boolean | null;
            
            type: "json_schema";
        };
        Output_Tool: components["schemas"]["Output_FunctionTool"] | components["schemas"]["Output_FileSearchTool"] | components["schemas"]["Output_ComputerTool"] | components["schemas"]["Output_ComputerUsePreviewTool"] | components["schemas"]["Output_WebSearchTool"] | components["schemas"]["Output_MCPTool"] | components["schemas"]["Output_CodeInterpreterTool"] | components["schemas"]["Output_ProgrammaticToolCallingParam"] | components["schemas"]["Output_ImageGenTool"] | components["schemas"]["Output_LocalShellToolParam"] | components["schemas"]["Output_FunctionShellToolParam"] | components["schemas"]["Output_CustomToolParam"] | components["schemas"]["Output_NamespaceToolParam"] | components["schemas"]["Output_ToolSearchToolParam"] | components["schemas"]["Output_WebSearchPreviewTool"] | components["schemas"]["Output_ApplyPatchToolParam"];
        Output_ToolCallCaller: components["schemas"]["Output_DirectToolCallCaller"] | components["schemas"]["Output_ProgramToolCallCaller"];
        Output_ToolCallCallerParam: components["schemas"]["Output_DirectToolCallCallerParam"] | components["schemas"]["Output_ProgramToolCallCallerParam"];
        
        Output_ToolChoiceAllowed: {
            
            mode: "auto" | "required";
            tools: {
                [key: string]: unknown;
            }[];
            
            type: "allowed_tools";
        };
        
        Output_ToolChoiceCustom: {
            name: string;
            
            type: "custom";
        };
        
        Output_ToolChoiceFunction: {
            name: string;
            
            type: "function";
        };
        
        Output_ToolChoiceMCP: {
            name?: string | null;
            server_label: string;
            
            type: "mcp";
        };
        
        Output_ToolChoiceOptions: "none" | "auto" | "required";
        Output_ToolChoiceParam: components["schemas"]["Output_ToolChoiceOptions"] | components["schemas"]["Output_ToolChoiceAllowed"] | components["schemas"]["Output_ToolChoiceTypes"] | components["schemas"]["Output_ToolChoiceFunction"] | components["schemas"]["Output_ToolChoiceMCP"] | components["schemas"]["Output_ToolChoiceCustom"] | components["schemas"]["Output_SpecificProgrammaticToolCallingParam"] | components["schemas"]["Output_SpecificApplyPatchParam"] | components["schemas"]["Output_SpecificFunctionShellParam"];
        
        Output_ToolChoiceTypes: {
            
            type: "file_search" | "web_search_preview" | "computer" | "computer_use_preview" | "computer_use" | "web_search_preview_2025_03_11" | "image_generation" | "code_interpreter";
        };
        Output_ToolsArray: components["schemas"]["Output_Tool"][];
        Output_ToolSearchCall: {
            arguments: unknown;
            call_id: string | null;
            created_by?: string;
            execution: components["schemas"]["Output_ToolSearchExecutionType"];
            id: string;
            status: components["schemas"]["Output_FunctionCallStatus"];
            
            type: "tool_search_call";
        };
        Output_ToolSearchCallItemParam: {
            arguments: components["schemas"]["Output_EmptyModelParam"];
            call_id?: string | null;
            execution?: components["schemas"]["Output_ToolSearchExecutionType"];
            id?: string | null;
            status?: components["schemas"]["Output_FunctionCallItemStatus"] | null;
            
            type: "tool_search_call";
        };
        
        Output_ToolSearchExecutionType: "server" | "client";
        Output_ToolSearchOutput: {
            call_id: string | null;
            created_by?: string;
            execution: components["schemas"]["Output_ToolSearchExecutionType"];
            id: string;
            status: components["schemas"]["Output_FunctionCallOutputStatusEnum"];
            tools: components["schemas"]["Output_Tool"][];
            
            type: "tool_search_output";
        };
        Output_ToolSearchOutputItemParam: {
            call_id?: string | null;
            execution?: components["schemas"]["Output_ToolSearchExecutionType"];
            id?: string | null;
            status?: components["schemas"]["Output_FunctionCallItemStatus"] | null;
            tools: components["schemas"]["Output_Tool"][];
            
            type: "tool_search_output";
        };
        
        Output_ToolSearchToolParam: {
            execution?: components["schemas"]["Output_ToolSearchExecutionType"];
            parameters?: components["schemas"]["Output_EmptyModelParam"] | null;
            
            type: "tool_search";
        };
        
        Output_TopLogProb: {
            bytes: number[];
            logprob: number;
            token: string;
        };
        
        Output_TypeParam: {
            text: string;
            
            type: "type";
        };
        
        Output_UrlCitationBody: {
            end_index: number;
            start_index: number;
            title: string;
            
            type: "url_citation";
            
            url: string;
        };
        Output_VectorStoreFileAttributes: {
            [key: string]: string | number | boolean;
        } | null;
        Output_Verbosity: ("low" | "medium" | "high") | null;
        
        Output_WaitParam: {
            
            type: "wait";
        };
        
        Output_WebSearchActionFind: {
            pattern: string;
            
            type: "find_in_page";
            
            url: string;
        };
        
        Output_WebSearchActionOpenPage: {
            
            type: "open_page";
            url?: string | null;
        };
        
        Output_WebSearchActionSearch: {
            
            queries?: string[];
            
            query?: string;
            
            sources?: {
                
                type: "url";
                
                url: string;
            }[];
            
            type: "search";
        };
        Output_WebSearchApproximateLocation: {
            city?: string | null;
            country?: string | null;
            region?: string | null;
            timezone?: string | null;
            
            type?: "approximate";
        } | null;
        
        Output_WebSearchCallStatus: "in_progress" | "searching" | "completed" | "failed" | "incomplete";
        
        Output_WebSearchPreviewTool: {
            search_content_types?: components["schemas"]["Output_SearchContentType"][];
            search_context_size?: components["schemas"]["Output_SearchContextSize"];
            
            type: "web_search_preview" | "web_search_preview_2025_03_11";
            user_location?: components["schemas"]["Output_ApproximateLocation"] | null;
        };
        
        Output_WebSearchTool: {
            
            external_web_access?: boolean;
            filters?: {
                allowed_domains?: string[] | null;
            } | null;
            
            search_context_size?: "low" | "medium" | "high";
            
            type: "web_search" | "web_search_2025_08_26";
            user_location?: components["schemas"]["Output_WebSearchApproximateLocation"];
        };
        
        Output_WebSearchToolCall: {
            action?: components["schemas"]["Output_WebSearchActionSearch"] | components["schemas"]["Output_WebSearchActionOpenPage"] | components["schemas"]["Output_WebSearchActionFind"];
            id: string;
            status: components["schemas"]["Output_WebSearchCallStatus"];
            
            type: "web_search_call";
        };
        
        OutputMessage: {
            content: components["schemas"]["OutputMessageContent"][];
            id: string;
            phase?: components["schemas"]["MessagePhase"] | null;
            
            role: "assistant";
            
            status: "in_progress" | "completed" | "incomplete";
            
            type: "message";
        };
        OutputMessageContent: components["schemas"]["OutputTextContent"] | components["schemas"]["RefusalContent"];
        
        OutputTextContent: {
            annotations: components["schemas"]["Annotation"][];
            logprobs: components["schemas"]["LogProb"][];
            text: string;
            
            type: "output_text";
        };
        
        ParallelToolCalls: boolean;
        
        PredictionContent: {
            content: string | components["schemas"]["ChatCompletionRequestMessageContentPartText"][];
            
            type: "content";
        };
        ProgramItemParam: {
            call_id: string;
            code: string;
            fingerprint: string;
            id: string;
            
            type: "program";
        };
        ProgrammaticToolCallingParam: {
            
            type: "programmatic_tool_calling";
        };
        ProgramOutputItemParam: {
            call_id: string;
            id: string;
            result: string;
            status: components["schemas"]["ProgramOutputItemStatus"];
            
            type: "program_output";
        };
        
        ProgramOutputItemStatus: "completed" | "incomplete";
        ProgramToolCallCaller: {
            caller_id: string;
            
            type: "program";
        };
        ProgramToolCallCallerParam: {
            caller_id: string;
            
            type: "program";
        };
        Prompt: {
            id: string;
            variables?: components["schemas"]["ResponsePromptVariables"];
            version?: string | null;
        } | null;
        
        PromptCacheBreakpointConfig: {
            
            mode: "explicit";
            ttl?: components["schemas"]["PromptCacheTTLEnum"];
        };
        
        PromptCacheBreakpointParam: {
            
            mode: "explicit";
            ttl?: components["schemas"]["PromptCacheTTLEnum"];
        };
        
        PromptCacheModeEnum: "implicit" | "explicit";
        
        PromptCacheOptionsParam: {
            mode?: components["schemas"]["PromptCacheModeEnum"];
            ttl?: components["schemas"]["ChatPromptCacheTTLEnum"];
        };
        
        PromptCacheTTLEnum: "30m" | "12h";
        
        RankerVersionType: "auto" | "default-2024-11-15";
        RankingOptions: {
            hybrid_search?: components["schemas"]["HybridSearchOptions"];
            ranker?: components["schemas"]["RankerVersionType"];
            score_threshold?: number;
        };
        
        Reasoning: {
            context?: ("auto" | "current_turn" | "all_turns") | null;
            effort?: components["schemas"]["ReasoningEffort"];
            generate_summary?: ("auto" | "concise" | "detailed") | null;
            mode?: components["schemas"]["ReasoningModeEnum"];
            summary?: ("auto" | "concise" | "detailed") | null;
        };
        ReasoningEffort: ("none" | "low" | "medium" | "high" | "xhigh" | "max") | null;
        
        ReasoningItem: {
            content?: components["schemas"]["ReasoningTextContent"][];
            encrypted_content?: string | null;
            id: string;
            
            status?: "in_progress" | "completed" | "incomplete";
            summary: components["schemas"]["SummaryTextContent"][];
            
            type: "reasoning";
        };
        ReasoningModeEnum: string | ("standard" | "pro");
        
        ReasoningTextContent: {
            text: string;
            
            type: "reasoning_text";
        };
        
        RefusalContent: {
            refusal: string;
            
            type: "refusal";
        };
        ResponseConfigurationUpdateItemParam: {
            id?: string | null;
            reasoning?: {
                effort?: components["schemas"]["ReasoningEffort"];
            };
            
            type: "configuration_update";
        };
        
        ResponseFormatJsonObject: {
            
            type: "json_object";
        };
        
        ResponseFormatJsonSchema: {
            
            json_schema: {
                name: string;
                schema?: components["schemas"]["ResponseFormatJsonSchemaSchema"];
                strict?: boolean | null;
            };
            
            type: "json_schema";
        };
        
        ResponseFormatJsonSchemaSchema: {
            [key: string]: unknown;
        };
        
        ResponseFormatText: {
            
            type: "text";
        };
        
        ResponsePromptCacheOptionsParam: {
            comparison_response_id?: string | null;
            mode?: components["schemas"]["PromptCacheModeEnum"];
            prewarm?: boolean;
            ttl?: components["schemas"]["PromptCacheTTLEnum"];
        };
        ResponsePromptVariables: {
            [key: string]: string | components["schemas"]["InputTextContent"] | components["schemas"]["InputImageContent"] | components["schemas"]["InputFileContent"];
        } | null;
        ResponsesEvent: components["schemas"]["Output_ResponseStreamEvent"];
        ResponsesRequest: {
            access_programs?: components["schemas"]["AccessProgramsParam"];
            context_management?: components["schemas"]["ContextManagementParam"][] | null;
            conversation?: never;
            include?: components["schemas"]["IncludeEnum"][] | null;
            input?: components["schemas"]["InputParam"];
            instructions?: string | null;
            max_output_tokens?: number | null;
            max_tool_calls?: number | null;
            metadata?: components["schemas"]["Metadata"];
            
            model: "openai/gpt-6.1-terra";
            moderation?: components["schemas"]["ModerationParam"] | null;
            parallel_tool_calls?: boolean | null;
            previous_response_id?: never;
            prompt?: components["schemas"]["Prompt"];
            prompt_cache_key?: string | null;
            prompt_cache_options?: components["schemas"]["ResponsePromptCacheOptionsParam"];
            reasoning?: components["schemas"]["Reasoning"] | null;
            safety_identifier?: string | null;
            service_tier?: components["schemas"]["ServiceTierResponses"];
            store?: never;
            stream?: boolean | null;
            stream_options?: components["schemas"]["ResponseStreamOptions"];
            temperature?: number | null;
            text?: components["schemas"]["ResponseTextParam"];
            tool_choice?: components["schemas"]["ToolChoiceParam"];
            tools?: components["schemas"]["ToolsArray"];
            top_logprobs?: number;
            top_p?: number | null;
            
            truncation?: ("auto" | "disabled") | null;
            
            user?: string | null;
        };
        ResponsesResponse: components["schemas"]["Output_Response"];
        ResponseStreamOptions: {
            include_obfuscation?: boolean;
        } | null;
        ResponseTextParam: {
            format?: components["schemas"]["TextResponseFormatConfiguration"];
            verbosity?: components["schemas"]["Verbosity"];
        };
        
        ScreenshotParam: {
            
            type: "screenshot";
        };
        
        ScrollParam: {
            keys?: string[] | null;
            scroll_x: number;
            scroll_y: number;
            
            type: "scroll";
            x: number;
            y: number;
        };
        
        SearchContentType: "text" | "image";
        
        SearchContextSize: "low" | "medium" | "high";
        ServiceTier: ("auto" | "default" | "flex" | "scale" | "priority" | "fast") | null;
        ServiceTierResponses: ("auto" | "default" | "flex" | "scale" | "priority" | "fast" | "ultrafast") | null;
        SkillReferenceParam: {
            skill_id: string;
            
            type: "skill_reference";
            version?: string;
        };
        
        SpecificApplyPatchParam: {
            
            type: "apply_patch";
        };
        
        SpecificFunctionShellParam: {
            
            type: "shell";
        };
        SpecificProgrammaticToolCallingParam: {
            
            type: "programmatic_tool_calling";
        };
        StopConfiguration: ((string | null) | string[]) | null;
        
        SummaryTextContent: {
            text: string;
            
            type: "summary_text";
        };
        TextResponseFormatConfiguration: components["schemas"]["ResponseFormatText"] | components["schemas"]["TextResponseFormatJsonSchema"] | components["schemas"]["ResponseFormatJsonObject"];
        
        TextResponseFormatJsonSchema: {
            name: string;
            schema: components["schemas"]["ResponseFormatJsonSchemaSchema"];
            strict?: boolean | null;
            
            type: "json_schema";
        };
        Tool: components["schemas"]["FunctionTool"] | components["schemas"]["FileSearchTool"] | components["schemas"]["ComputerTool"] | components["schemas"]["ComputerUsePreviewTool"] | components["schemas"]["WebSearchTool"] | components["schemas"]["MCPTool"] | components["schemas"]["CodeInterpreterTool"] | components["schemas"]["ProgrammaticToolCallingParam"] | components["schemas"]["ImageGenTool"] | components["schemas"]["LocalShellToolParam"] | components["schemas"]["FunctionShellToolParam"] | components["schemas"]["CustomToolParam"] | components["schemas"]["NamespaceToolParam"] | components["schemas"]["ToolSearchToolParam"] | components["schemas"]["WebSearchPreviewTool"] | components["schemas"]["ApplyPatchToolParam"];
        ToolCallCaller: components["schemas"]["DirectToolCallCaller"] | components["schemas"]["ProgramToolCallCaller"];
        ToolCallCallerParam: components["schemas"]["DirectToolCallCallerParam"] | components["schemas"]["ProgramToolCallCallerParam"];
        
        ToolChoiceAllowed: {
            
            mode: "auto" | "required";
            tools: {
                [key: string]: unknown;
            }[];
            
            type: "allowed_tools";
        };
        
        ToolChoiceCustom: {
            name: string;
            
            type: "custom";
        };
        
        ToolChoiceFunction: {
            name: string;
            
            type: "function";
        };
        
        ToolChoiceMCP: {
            name?: string | null;
            server_label: string;
            
            type: "mcp";
        };
        
        ToolChoiceOptions: "none" | "auto" | "required";
        ToolChoiceParam: components["schemas"]["ToolChoiceOptions"] | components["schemas"]["ToolChoiceAllowed"] | components["schemas"]["ToolChoiceTypes"] | components["schemas"]["ToolChoiceFunction"] | components["schemas"]["ToolChoiceMCP"] | components["schemas"]["ToolChoiceCustom"] | components["schemas"]["SpecificProgrammaticToolCallingParam"] | components["schemas"]["SpecificApplyPatchParam"] | components["schemas"]["SpecificFunctionShellParam"];
        
        ToolChoiceTypes: {
            
            type: "file_search" | "web_search_preview" | "computer" | "computer_use_preview" | "computer_use" | "web_search_preview_2025_03_11" | "image_generation" | "code_interpreter";
        };
        ToolsArray: components["schemas"]["Tool"][];
        ToolSearchCallItemParam: {
            arguments: components["schemas"]["EmptyModelParam"];
            call_id?: string | null;
            execution?: components["schemas"]["ToolSearchExecutionType"];
            id?: string | null;
            status?: components["schemas"]["FunctionCallItemStatus"] | null;
            
            type: "tool_search_call";
        };
        
        ToolSearchExecutionType: "server" | "client";
        ToolSearchOutputItemParam: {
            call_id?: string | null;
            execution?: components["schemas"]["ToolSearchExecutionType"];
            id?: string | null;
            status?: components["schemas"]["FunctionCallItemStatus"] | null;
            tools: components["schemas"]["Tool"][];
            
            type: "tool_search_output";
        };
        
        ToolSearchToolParam: {
            execution?: components["schemas"]["ToolSearchExecutionType"];
            parameters?: components["schemas"]["EmptyModelParam"] | null;
            
            type: "tool_search";
        };
        
        TopLogProb: {
            bytes: number[];
            logprob: number;
            token: string;
        };
        
        TypeParam: {
            text: string;
            
            type: "type";
        };
        
        UrlCitationBody: {
            end_index: number;
            start_index: number;
            title: string;
            
            type: "url_citation";
            
            url: string;
        };
        VectorStoreFileAttributes: {
            [key: string]: string | number | boolean;
        } | null;
        Verbosity: ("low" | "medium" | "high") | null;
        
        WaitParam: {
            
            type: "wait";
        };
        
        WebSearchActionFind: {
            pattern: string;
            
            type: "find_in_page";
            
            url: string;
        };
        
        WebSearchActionOpenPage: {
            
            type: "open_page";
            url?: string | null;
        };
        
        WebSearchActionSearch: {
            
            queries?: string[];
            
            query?: string;
            
            sources?: {
                
                type: "url";
                
                url: string;
            }[];
            
            type: "search";
        };
        WebSearchApproximateLocation: {
            city?: string | null;
            country?: string | null;
            region?: string | null;
            timezone?: string | null;
            
            type?: "approximate";
        } | null;
        
        WebSearchCallStatus: "in_progress" | "searching" | "completed" | "failed" | "incomplete";
        
        WebSearchPreviewTool: {
            search_content_types?: components["schemas"]["SearchContentType"][];
            search_context_size?: components["schemas"]["SearchContextSize"];
            
            type: "web_search_preview" | "web_search_preview_2025_03_11";
            user_location?: components["schemas"]["ApproximateLocation"] | null;
        };
        
        WebSearchTool: {
            
            external_web_access?: boolean;
            filters?: {
                allowed_domains?: string[] | null;
            } | null;
            
            search_context_size?: "low" | "medium" | "high";
            
            type: "web_search" | "web_search_2025_08_26";
            user_location?: components["schemas"]["WebSearchApproximateLocation"];
        };
        
        WebSearchToolCall: {
            action?: components["schemas"]["WebSearchActionSearch"] | components["schemas"]["WebSearchActionOpenPage"] | components["schemas"]["WebSearchActionFind"];
            id: string;
            status: components["schemas"]["WebSearchCallStatus"];
            
            type: "web_search_call";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

}
declare module "@lovable.dev/ai-gateway" {
  interface GeneratedModelsBySurface {
    "chat-completions": "google/gemini-2.5-flash" | "google/gemini-2.5-flash-image" | "google/gemini-2.5-flash-lite" | "google/gemini-2.5-pro" | "google/gemini-3-flash-preview" | "google/gemini-3-pro-image" | "google/gemini-3.1-flash-image" | "google/gemini-3.1-flash-lite" | "google/gemini-3.1-pro-preview" | "google/gemini-3.5-flash" | "google/gemini-3.6-flash" | "google/gemini-3.7-flash" | "google/gemini-3.8-flash" | "openai/chat-latest" | "openai/gpt-5" | "openai/gpt-5-mini" | "openai/gpt-5-nano" | "openai/gpt-5.2" | "openai/gpt-5.4" | "openai/gpt-5.4-mini" | "openai/gpt-5.4-nano" | "openai/gpt-5.5" | "openai/gpt-5.6-luna" | "openai/gpt-5.6-sol" | "openai/gpt-5.6-terra" | "openai/gpt-6-astra" | "openai/gpt-6.1-terra";
    "responses": "openai/chat-latest" | "openai/gpt-5" | "openai/gpt-5-mini" | "openai/gpt-5-nano" | "openai/gpt-5.2" | "openai/gpt-5.4" | "openai/gpt-5.4-mini" | "openai/gpt-5.4-nano" | "openai/gpt-5.4-pro" | "openai/gpt-5.5" | "openai/gpt-5.5-pro" | "openai/gpt-5.6-luna" | "openai/gpt-5.6-sol" | "openai/gpt-5.6-terra" | "openai/gpt-6-astra" | "openai/gpt-6.1-terra";
    "messages": never;
    "interactions": never;
    "image-generation": "google/gemini-2.5-flash-image" | "google/gemini-3-pro-image" | "google/gemini-3.1-flash-image" | "google/gemini-3.1-flash-lite-image" | "openai/gpt-image-1-mini" | "openai/gpt-image-2";
    "image-edit": "openai/gpt-image-1-mini" | "openai/gpt-image-2";
    "embeddings": "google/gemini-embedding-001" | "google/gemini-embedding-2" | "openai/text-embedding-3-large" | "openai/text-embedding-3-small";
    "speech": "google/gemini-2.5-flash-lite-preview-tts" | "google/gemini-2.5-flash-tts" | "google/gemini-2.5-pro-tts" | "google/gemini-3.1-flash-tts-preview" | "openai/gpt-4o-mini-tts";
    "transcription": "google/gemini-3.5-transcribe" | "openai/gpt-4o-mini-transcribe" | "openai/gpt-4o-transcribe";
    "music": never;
    "videos": "google/gemini-omni-1.1-flash" | "google/veo-3.1" | "google/veo-3.1-fast" | "google/veo-3.1-lite";
    "systemone": never;
    "live": never;
  }
  interface ChatFieldsByModel {
    "openai/gpt-6.1-terra": ModelContract_1dcd13c2fce7d97b.components["schemas"]["ChatRequest"];
  }
  interface ResponsesFieldsByModel {
    "openai/gpt-6.1-terra": ModelContract_1dcd13c2fce7d97b.components["schemas"]["ResponsesRequest"];
  }
  interface ChatResponseByModel {
    "openai/gpt-6.1-terra": ModelContract_1dcd13c2fce7d97b.components["schemas"]["ChatResponse"];
  }
  interface ResponsesResponseByModel {
    "openai/gpt-6.1-terra": ModelContract_1dcd13c2fce7d97b.components["schemas"]["ResponsesResponse"];
  }
  interface ChatEventByModel {
    "openai/gpt-6.1-terra": ModelContract_1dcd13c2fce7d97b.components["schemas"]["ChatEvent"];
  }
  interface ResponsesEventByModel {
    "openai/gpt-6.1-terra": ModelContract_1dcd13c2fce7d97b.components["schemas"]["ResponsesEvent"];
  }
}
