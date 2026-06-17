output "vm_public_ip" {
  description = "Public IP of the VM — set this as GitHub secret AZURE_VM_HOST"
  value       = azurerm_public_ip.main.ip_address
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}
