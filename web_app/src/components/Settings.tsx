import { IconButton } from "@/components/ui/button"
import { useToggle } from "@uidotdev/usehooks"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog"
import { HelpCircle, Settings } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "./ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { fetchModelInfos, switchModel } from "@/lib/api"
import { ModelInfo } from "@/lib/types"
import { useStore } from "@/lib/states"
import { ScrollArea } from "./ui/scroll-area"
import { useToast } from "./ui/use-toast"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
} from "./ui/alert-dialog"
import {
  MODEL_TYPE_DIFFUSERS_SD,
  MODEL_TYPE_DIFFUSERS_SDXL,
  MODEL_TYPE_DIFFUSERS_SDXL_INPAINT,
  MODEL_TYPE_DIFFUSERS_SD_INPAINT,
  MODEL_TYPE_INPAINT,
  MODEL_TYPE_OTHER,
} from "@/lib/const"
import useHotKey from "@/hooks/useHotkey"

const formSchema = z.object({
  enableFileManager: z.boolean(),
  inputDirectory: z.string().refine(async (id) => {
    // verify that ID exists in database
    return true
  }),
  outputDirectory: z.string().refine(async (id) => {
    // verify that ID exists in database
    return true
  }),
  enableDownloadMask: z.boolean(),
  enableManualInpainting: z.boolean(),
  enableUploadMask: z.boolean(),
})

const TAB_GENERAL = "General"
const TAB_MODEL = "Model"
const TAB_FILE_MANAGER = "File Manager"

const TAB_NAMES = [TAB_MODEL, TAB_GENERAL]

export function SettingsDialog() {
  const [open, toggleOpen] = useToggle(false)
  const [openModelSwitching, toggleOpenModelSwitching] = useToggle(false)
  const [tab, setTab] = useState(TAB_MODEL)
  const [
    updateAppState,
    settings,
    updateSettings,
    fileManagerState,
    updateFileManagerState,
    setAppModel,
  ] = useStore((state) => [
    state.updateAppState,
    state.settings,
    state.updateSettings,
    state.fileManagerState,
    state.updateFileManagerState,
    state.setModel,
  ])
  const { toast } = useToast()
  const [model, setModel] = useState<ModelInfo>(settings.model)
  useEffect(() => {
    setModel(settings.model)
  }, [settings.model])

  const { data: modelInfos, status } = useQuery({
    queryKey: ["modelInfos"],
    queryFn: fetchModelInfos,
  })

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enableDownloadMask: settings.enableDownloadMask,
      enableManualInpainting: settings.enableManualInpainting,
      enableUploadMask: settings.enableUploadMask,
      inputDirectory: fileManagerState.inputDirectory,
      outputDirectory: fileManagerState.outputDirectory,
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values. ✅ This will be type-safe and validated.
    updateSettings({
      enableDownloadMask: values.enableDownloadMask,
      enableManualInpainting: values.enableManualInpainting,
      enableUploadMask: values.enableUploadMask,
    })

    // TODO: validate input/output Directory
    updateFileManagerState({
      inputDirectory: values.inputDirectory,
      outputDirectory: values.outputDirectory,
    })
    if (model.name !== settings.model.name) {
      toggleOpenModelSwitching()
      updateAppState({ disableShortCuts: true })
      switchModel(model.name)
        .then((res) => {
          if (res.ok) {
            toast({
              title: `Switch to ${model.name} success`,
            })
            setAppModel(model)
          } else {
            throw new Error("Server error")
          }
        })
        .catch(() => {
          toast({
            variant: "destructive",
            title: `Switch to ${model.name} failed`,
          })
          setModel(settings.model)
        })
        .finally(() => {
          toggleOpenModelSwitching()
          updateAppState({ disableShortCuts: false })
        })
    }
  }

  useHotKey(
    "s",
    () => {
      toggleOpen()
      if (open) {
        onSubmit(form.getValues())
      }
    },
    [open, form, model]
  )

  function onOpenChange(value: boolean) {
    toggleOpen()
    if (!value) {
      onSubmit(form.getValues())
    }
  }

  function onModelSelect(info: ModelInfo) {
    setModel(info)
  }

  function renderModelList(model_types: string[]) {
    if (!modelInfos) {
      return <div>Please download model first</div>
    }
    return modelInfos
      .filter((info) => model_types.includes(info.model_type))
      .map((info: ModelInfo) => {
        return (
          <div key={info.name} onClick={() => onModelSelect(info)}>
            <div
              className={cn([
                info.name === model.name ? "bg-muted " : "hover:bg-muted",
                "rounded-md px-2 py-1 my-1",
                "cursor-default",
              ])}
            >
              <div className="text-base max-w-sm">{info.name}</div>
            </div>
            <Separator />
          </div>
        )
      })
  }

  function renderModelSettings() {
    if (status !== "success") {
      return <></>
    }

    let defaultTab = MODEL_TYPE_INPAINT
    for (let info of modelInfos) {
      if (model.name === info.name) {
        defaultTab = info.model_type
        if (defaultTab === MODEL_TYPE_DIFFUSERS_SDXL) {
          defaultTab = MODEL_TYPE_DIFFUSERS_SD
        }
        if (defaultTab === MODEL_TYPE_DIFFUSERS_SDXL_INPAINT) {
          defaultTab = MODEL_TYPE_DIFFUSERS_SD_INPAINT
        }
        break
      }
    }

    return (
      <div className="flex flex-col gap-4 w-[510px]">
        <div className="flex flex-col gap-4 rounded-md">
          <div className="font-medium">Current Model</div>
          <div>{model.name}</div>
        </div>

        <Separator />

        <div className="space-y-4  rounded-md">
          <div className="flex gap-1 items-center justify-start">
            <div className="font-medium">Available models</div>
            {/* <IconButton tooltip="How to download new model" asChild>
              <HelpCircle size={16} strokeWidth={1.5} className="opacity-50" />
            </IconButton> */}
          </div>
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value={MODEL_TYPE_INPAINT}>Erase</TabsTrigger>
              <TabsTrigger value={MODEL_TYPE_DIFFUSERS_SD}>
                Stable Diffusion
              </TabsTrigger>
              <TabsTrigger value={MODEL_TYPE_DIFFUSERS_SD_INPAINT}>
                Stable Diffusion Inpaint
              </TabsTrigger>
              <TabsTrigger value={MODEL_TYPE_OTHER}>
                Other Diffusion
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="h-[240px] w-full mt-2 outline-none border rounded-lg">
              <TabsContent value={MODEL_TYPE_INPAINT}>
                {renderModelList([MODEL_TYPE_INPAINT])}
              </TabsContent>
              <TabsContent value={MODEL_TYPE_DIFFUSERS_SD}>
                {renderModelList([
                  MODEL_TYPE_DIFFUSERS_SD,
                  MODEL_TYPE_DIFFUSERS_SDXL,
                ])}
              </TabsContent>
              <TabsContent value={MODEL_TYPE_DIFFUSERS_SD_INPAINT}>
                {renderModelList([
                  MODEL_TYPE_DIFFUSERS_SD_INPAINT,
                  MODEL_TYPE_DIFFUSERS_SDXL_INPAINT,
                ])}
              </TabsContent>
              <TabsContent value={MODEL_TYPE_OTHER}>
                {renderModelList([MODEL_TYPE_OTHER])}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    )
  }

  function renderGeneralSettings() {
    return (
      <div className="space-y-4 w-[510px]">
        <FormField
          control={form.control}
          name="enableManualInpainting"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Enable manual inpainting</FormLabel>
                <FormDescription>
                  For erase model, click a button to trigger inpainting after
                  draw mask.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Separator />

        <FormField
          control={form.control}
          name="enableDownloadMask"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Enable download mask</FormLabel>
                <FormDescription>
                  Also download the mask after save the inpainting result.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Separator />

        {/* <FormField
          control={form.control}
          name="enableUploadMask"
          render={({ field }) => (
            <FormItem className="flex tems-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Enable upload mask</FormLabel>
                <FormDescription>
                  Enable upload custom mask to perform inpainting.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Separator /> */}
      </div>
    )
  }

  function renderFileManagerSettings() {
    return (
      <div className="flex flex-col justify-between rounded-lg gap-4 w-[400px]">
        <FormField
          control={form.control}
          name="enableFileManager"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <FormLabel>Enable file manger</FormLabel>
                <FormDescription className="max-w-sm">
                  Browser images
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Separator />

        <FormField
          control={form.control}
          name="inputDirectory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Input directory</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
              <FormDescription>
                Browser images from this directory.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="outputDirectory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Save directory</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
              <FormDescription>
                Result images will be saved to this directory.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    )
  }

  return (
    <>
      <AlertDialog open={openModelSwitching}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* <AlertDialogDescription> */}
            <div className="flex flex-col justify-center items-center gap-4">
              <div role="status">
                <svg
                  aria-hidden="true"
                  className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-primary"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
                <span className="sr-only">Loading...</span>
              </div>

              <div>Switching to {model.name}</div>
            </div>
            {/* </AlertDialogDescription> */}
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <IconButton tooltip="Settings">
            <Settings />
          </IconButton>
        </DialogTrigger>
        <DialogContent
          className="max-w-3xl h-[600px]"
          // onEscapeKeyDown={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          // onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle>Settings</DialogTitle>
          <Separator />

          <div className="flex flex-row space-x-8 h-full">
            <div className="flex flex-col space-y-1">
              {TAB_NAMES.map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  onClick={() => setTab(item)}
                  className={cn(
                    tab === item ? "bg-muted " : "hover:bg-muted",
                    "justify-start"
                  )}
                >
                  {item}
                </Button>
              ))}
            </div>
            <Separator orientation="vertical" />
            <Form {...form}>
              <div className="flex w-full justify-center">
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  {tab === TAB_MODEL ? renderModelSettings() : <></>}
                  {tab === TAB_GENERAL ? renderGeneralSettings() : <></>}
                  {/* {tab === TAB_FILE_MANAGER ? (
                    renderFileManagerSettings()
                  ) : (
                    <></>
                  )} */}

                  <div className="absolute right-10 bottom-6">
                    <Button onClick={() => onOpenChange(false)}>Ok</Button>
                  </div>
                </form>
              </div>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SettingsDialog