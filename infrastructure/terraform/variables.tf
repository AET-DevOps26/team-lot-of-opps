variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "lot-of-opps-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "germanywestcentral"
}

variable "vm_name" {
  description = "Name of the virtual machine"
  type        = string
  default     = "lot-of-opps-vm"
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "admin_username" {
  description = "Admin username for the VM (must match GitHub secret AZURE_VM_USER)"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "SSH public key content for VM access (e.g. contents of ~/.ssh/id_rsa.pub)"
  type        = string
  sensitive   = true
}
