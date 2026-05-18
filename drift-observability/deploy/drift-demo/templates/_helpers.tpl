{{- define "drift-demo.appName" -}}
{{- printf "%s-app" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "drift-demo.obsName" -}}
{{- printf "%s-obs" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "drift-demo.commonLabels" -}}
app.kubernetes.io/part-of: drift-demo
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
