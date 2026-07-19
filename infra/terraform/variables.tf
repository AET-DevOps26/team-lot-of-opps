variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "lot-of-opps-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "polandcentral"
}

variable "vm_name" {
  description = "Name of the virtual machine"
  type        = string
  default     = "lot-of-opps-vm"
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
  # B4als_v2 = 4 vCPU / 16 GiB (AMD Bsv2, ~10% cheaper than the Intel B4s_v2).
  # 4 vCPU is enough: this single node has no ResourceQuota, so limits may
  # overcommit — only requests (~2.5 vCPU incl. observability + k3s) must fit,
  # and the maxSurge:0 rollout strategy keeps upgrades within it. Idle the box
  # with vm-stop.yml to save more. If AMD Bsv2 is unavailable at apply time,
  # fall back to the Intel "Standard_B4s_v2".
  default = "Standard_B4als_v2"
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
