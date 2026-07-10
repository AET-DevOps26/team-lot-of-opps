variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "lot-of-opps-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "swedencentral"
}

variable "vm_name" {
  description = "Name of the virtual machine"
  type        = string
  default     = "lot-of-opps-vm"
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
  # Bsv2 family (B-series v1 not offered in swedencentral). B4s_v2 = 4 vCPU / 16 GiB;
  # 2 vCPU (B2s_v2) can't fit the RollingUpdate surge of all deployments at once.
  default = "Standard_B4s_v2"
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "SSH public key content for VM access (e.g. contents of ~/.ssh/id_rsa.pub)"
  type        = string
  sensitive   = true
}
